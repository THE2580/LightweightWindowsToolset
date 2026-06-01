using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace AppStats;

internal static unsafe class Program
{
    private static readonly IntPtr IpcTimer = new(1);
    private static readonly IntPtr SampleTimer = new(2);
    private static readonly IntPtr SaveTimer = new(3);
    private static readonly Stopwatch Clock = Stopwatch.StartNew();
    private static readonly HashSet<string> IgnoredProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "appstats.exe",
        "LockApp.exe",
        "LogonUI.exe",
    };

    private static IntPtr _window;
    private static StatsStore? _store;
    private static TimeSpan _lastSampleAt;
    private static string? _activeProcess;
    private static bool _isAfk;
    private static int _afkThresholdSec = 300;

    [STAThread]
    public static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;
        string storagePath = args.Length > 0 ? args[0] : Path.Combine(AppContext.BaseDirectory, "appstats.json");
        Log("info", $"Starting pid={Environment.ProcessId} storage=\"{Escape(storagePath)}\"");

        using var mutex = new Mutex(true, @"Global\LightweightWindowsToolset_AppStats", out bool createdNew);
        if (!createdNew)
        {
            Log("warn", "Another instance is already running");
            return 0;
        }

        _store = new StatsStore(storagePath);
        _window = CreateMessageWindow(Native.GetModuleHandle(null));
        if (_window == IntPtr.Zero)
        {
            Log("error", $"Failed to create message window win32={Marshal.GetLastWin32Error()}");
            return 1;
        }

        _lastSampleAt = Clock.Elapsed;
        Native.SetTimer(_window, IpcTimer, 200, IntPtr.Zero);
        Native.SetTimer(_window, SampleTimer, 1_000, IntPtr.Zero);
        Native.SetTimer(_window, SaveTimer, 10_000, IntPtr.Zero);
        Log("info", $"Statistics collection active afkThresholdSec={_afkThresholdSec}");

        Native.MSG message;
        int result;
        while ((result = Native.GetMessage(&message, IntPtr.Zero, 0, 0)) != 0)
        {
            if (result == -1)
            {
                Log("error", $"GetMessage failed win32={Marshal.GetLastWin32Error()}");
                break;
            }
            Native.TranslateMessage(&message);
            Native.DispatchMessage(&message);
        }

        Save();
        Log("info", "Shutdown complete");
        return 0;
    }

    [UnmanagedCallersOnly(CallConvs = [typeof(CallConvStdcall)])]
    private static IntPtr WindowProc(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam)
    {
        switch (message)
        {
            case Native.WM_TIMER:
                if (wParam == IpcTimer) PollIpc();
                else if (wParam == SampleTimer) Sample();
                else if (wParam == SaveTimer) Save();
                return IntPtr.Zero;
            case Native.WM_DESTROY:
                Native.PostQuitMessage(0);
                return IntPtr.Zero;
        }
        return Native.DefWindowProc(hwnd, message, wParam, lParam);
    }

    private static void Sample()
    {
        TimeSpan now = Clock.Elapsed;
        double elapsedSec = (now - _lastSampleAt).TotalSeconds;
        _lastSampleAt = now;

        _isAfk = GetIdleSeconds() >= _afkThresholdSec;
        _activeProcess = GetForegroundProcessName();

        // Ignore long gaps caused by sleep, hibernation, or debugger pauses.
        if (elapsedSec <= 0 || elapsedSec > 5 || _isAfk || _activeProcess is null) return;
        _store?.AddUsage(_activeProcess, elapsedSec);
    }

    private static uint GetIdleSeconds()
    {
        var info = new Native.LASTINPUTINFO { Size = (uint)sizeof(Native.LASTINPUTINFO) };
        if (!Native.GetLastInputInfo(ref info)) return 0;
        uint elapsedMs = unchecked((uint)Environment.TickCount - info.Time);
        return elapsedMs / 1000;
    }

    private static string? GetForegroundProcessName()
    {
        IntPtr hwnd = Native.GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return null;
        Native.GetWindowThreadProcessId(hwnd, out uint processId);
        if (processId == 0 || processId == Environment.ProcessId) return null;
        try
        {
            using Process process = Process.GetProcessById((int)processId);
            string name = process.ProcessName + ".exe";
            return IgnoredProcesses.Contains(name) ? null : name;
        }
        catch
        {
            return null;
        }
    }

    private static void PollIpc()
    {
        try
        {
            if (Console.In.Peek() == -1) return;
            string? line = Console.In.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) return;
            string command = line.Trim();
            if (command.Equals("PING", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine("PONG");
            }
            else if (command.Equals("SNAPSHOT", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine("OK " + (_store?.Snapshot(_activeProcess, _isAfk, _afkThresholdSec) ?? "{\"today\":\"\",\"activeProcess\":null,\"isAfk\":false,\"afkThresholdSec\":300,\"days\":{}}"));
            }
            else if (command.Equals("SAVE", StringComparison.OrdinalIgnoreCase))
            {
                Save();
                Console.WriteLine("OK");
            }
            else if (command.Equals("CLEAR", StringComparison.OrdinalIgnoreCase))
            {
                _store?.Clear();
                Console.WriteLine("OK");
            }
            else if (command.StartsWith("CONFIG ", StringComparison.OrdinalIgnoreCase))
            {
                Configure(command["CONFIG ".Length..]);
            }
            else if (command.Equals("SHUTDOWN", StringComparison.OrdinalIgnoreCase))
            {
                Save();
                Console.WriteLine("OK");
                Native.PostMessage(_window, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
            }
            else
            {
                Console.WriteLine("ERR unknown");
            }
        }
        catch (Exception ex)
        {
            Log("error", $"IPC failed: {Escape(ex.Message)}");
        }
    }

    private static void Configure(string value)
    {
        const string prefix = "afkThresholdSec=";
        if (!value.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            || !int.TryParse(value[prefix.Length..], out int threshold)
            || threshold is < 30 or > 3600)
        {
            Console.WriteLine("ERR config");
            return;
        }
        _afkThresholdSec = threshold;
        Log("info", $"AFK threshold updated: {_afkThresholdSec}s");
        Console.WriteLine("OK");
    }

    private static void Save()
    {
        try { _store?.Save(); }
        catch (Exception ex) { Log("error", $"Persistence save failed: {Escape(ex.Message)}"); }
    }

    private static IntPtr CreateMessageWindow(IntPtr instance)
    {
        const string className = "LightweightWindowsToolsetAppStats";
        fixed (char* pointer = className)
        {
            var windowClass = new Native.WNDCLASSEX
            {
                Size = (uint)sizeof(Native.WNDCLASSEX),
                WindowProc = &WindowProc,
                Instance = instance,
                ClassName = pointer,
            };
            Native.RegisterClassEx(ref windowClass);
        }
        return Native.CreateWindowEx(0, className, "AppStats", Native.WS_POPUP, 0, 0, 0, 0,
            IntPtr.Zero, IntPtr.Zero, instance, null);
    }

    private static void Log(string level, string message) => Console.Error.WriteLine($"@APPSTATS_LOG {level} {message}");
    private static string Escape(string value) => value.Replace("\r", "\\r").Replace("\n", "\\n");
}
