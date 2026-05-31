using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace KeyStats;

internal static unsafe class Program
{
    private static readonly IntPtr IpcTimer = new(1);
    private static readonly IntPtr SaveTimer = new(2);
    private static IntPtr _window;
    private static StatsStore? _store;

    [STAThread]
    public static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;
        string storagePath = args.Length > 0 ? args[0] : Path.Combine(AppContext.BaseDirectory, "keystats.json");
        Log("info", $"Starting pid={Environment.ProcessId} storage=\"{Escape(storagePath)}\"");

        using var mutex = new Mutex(true, @"Global\LightweightWindowsToolset_KeyStats", out bool createdNew);
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
        if (!RegisterInput())
        {
            Log("error", $"RegisterRawInputDevices failed win32={Marshal.GetLastWin32Error()}");
            return 2;
        }

        Native.SetTimer(_window, IpcTimer, 200, IntPtr.Zero);
        Native.SetTimer(_window, SaveTimer, 10_000, IntPtr.Zero);
        Log("info", "Raw Input registered; statistics collection active");

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
            case Native.WM_INPUT:
                ProcessInput(lParam);
                return IntPtr.Zero;
            case Native.WM_TIMER:
                if (wParam == IpcTimer) PollIpc();
                else if (wParam == SaveTimer) Save();
                return IntPtr.Zero;
            case Native.WM_DESTROY:
                Native.PostQuitMessage(0);
                return IntPtr.Zero;
        }
        return Native.DefWindowProc(hwnd, message, wParam, lParam);
    }

    private static bool RegisterInput()
    {
        var devices = new[]
        {
            new Native.RAWINPUTDEVICE { UsagePage = 0x01, Usage = 0x02, Flags = Native.RIDEV_INPUTSINK, Target = _window },
            new Native.RAWINPUTDEVICE { UsagePage = 0x01, Usage = 0x06, Flags = Native.RIDEV_INPUTSINK, Target = _window },
        };
        return Native.RegisterRawInputDevices(devices, (uint)devices.Length, (uint)Marshal.SizeOf<Native.RAWINPUTDEVICE>());
    }

    private static void ProcessInput(IntPtr handle)
    {
        uint size = (uint)sizeof(Native.RAWINPUT);
        Native.RAWINPUT input;
        uint read = Native.GetRawInputData(handle, Native.RID_INPUT, &input, ref size, (uint)sizeof(Native.RAWINPUTHEADER));
        if (read == uint.MaxValue) return;

        if (input.Header.Type == Native.RIM_TYPEKEYBOARD)
        {
            if ((input.Data.Keyboard.Flags & Native.RI_KEY_BREAK) == 0)
                _store?.Increment(KeyName(input.Data.Keyboard.VKey, input.Data.Keyboard.Flags));
            return;
        }
        if (input.Header.Type != Native.RIM_TYPEMOUSE) return;

        ushort flags = input.Data.Mouse.ButtonFlags;
        if ((flags & Native.RI_MOUSE_LEFT_BUTTON_DOWN) != 0) _store?.Increment("鼠标左键");
        if ((flags & Native.RI_MOUSE_RIGHT_BUTTON_DOWN) != 0) _store?.Increment("鼠标右键");
        if ((flags & Native.RI_MOUSE_MIDDLE_BUTTON_DOWN) != 0) _store?.Increment("鼠标中键");
    }

    private static void PollIpc()
    {
        try
        {
            if (Console.In.Peek() == -1) return;
            string? line = Console.In.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) return;
            string command = line.Trim().ToUpperInvariant();
            switch (command)
            {
                case "PING":
                    Console.WriteLine("PONG");
                    break;
                case "SNAPSHOT":
                    Console.WriteLine("OK " + (_store?.Snapshot() ?? "{\"today\":\"\",\"days\":{}}"));
                    break;
                case "SAVE":
                    Save();
                    Console.WriteLine("OK");
                    break;
                case "SHUTDOWN":
                    Save();
                    Console.WriteLine("OK");
                    Native.PostMessage(_window, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    break;
                default:
                    Console.WriteLine("ERR unknown");
                    break;
            }
        }
        catch (Exception ex)
        {
            Log("error", $"IPC failed: {Escape(ex.Message)}");
        }
    }

    private static void Save()
    {
        try { _store?.Save(); }
        catch (Exception ex) { Log("error", $"Persistence save failed: {Escape(ex.Message)}"); }
    }

    private static IntPtr CreateMessageWindow(IntPtr instance)
    {
        const string className = "LightweightWindowsToolsetKeyStats";
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
        return Native.CreateWindowEx(0, className, "KeyStats", Native.WS_POPUP, 0, 0, 0, 0,
            IntPtr.Zero, IntPtr.Zero, instance, null);
    }

    private static string KeyName(ushort key, ushort flags) => key switch
    {
        0x0D when (flags & Native.RI_KEY_E0) != 0 => "NumEnter",
        >= 0x30 and <= 0x39 => ((char)key).ToString(),
        >= 0x41 and <= 0x5A => ((char)key).ToString(),
        >= 0x70 and <= 0x7B => $"F{key - 0x6F}",
        0x08 => "Backspace", 0x09 => "Tab", 0x0D => "Enter", 0x10 => "Shift",
        0x11 => "Ctrl", 0x12 => "Alt", 0x14 => "CapsLock", 0x1B => "Esc",
        0x20 => "Space", 0x21 => "PageUp", 0x22 => "PageDown", 0x23 => "End",
        0x24 => "Home", 0x25 => "←", 0x26 => "↑", 0x27 => "→", 0x28 => "↓",
        0x2D => "Insert", 0x2E => "Delete", 0x5B => "Win", 0x5C => "Win",
        0x60 => "Num0", 0x61 => "Num1", 0x62 => "Num2", 0x63 => "Num3",
        0x64 => "Num4", 0x65 => "Num5", 0x66 => "Num6", 0x67 => "Num7",
        0x68 => "Num8", 0x69 => "Num9", 0x6A => "Num*", 0x6B => "Num+",
        0x6D => "Num-", 0x6E => "Num.", 0x6F => "Num/",
        0x90 => "NumLock",
        0xBA => ";", 0xBB => "=", 0xBC => ",", 0xBD => "-", 0xBE => ".",
        0xBF => "/", 0xC0 => "`", 0xDB => "[", 0xDC => "\\", 0xDD => "]", 0xDE => "'",
        _ => $"VK_{key:X2}",
    };

    private static void Log(string level, string message) => Console.Error.WriteLine($"@KEYSTATS_LOG {level} {message}");
    private static string Escape(string value) => value.Replace("\r", "\\r").Replace("\n", "\\n");
}
