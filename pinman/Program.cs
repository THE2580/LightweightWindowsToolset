using System.Collections.Concurrent;
using System.Runtime.InteropServices;

namespace PinMan;

internal static unsafe class Program
{
    private static readonly ConcurrentDictionary<IntPtr, PinEntry> _pins = new();
    private static IntPtr _msgWnd;
    private static int _maxPins = 10;
    private static uint _hotkeyMods;
    private static uint _hotkeyVk;
    private static bool _hotkeyActive;
    private static IntPtr _trayIcon;
    private static bool _topmostSelf;
    private static IntPtr _selfHwnd = IntPtr.Zero;

    [STAThread]
    public static int Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;
        using var mutex = new Mutex(true, @"Global\PinMan_SingleInstance", out bool createdNew);
        if (!createdNew)
        {
            StdioIpc.SendToggle();
            return 0;
        }

        IntPtr hInstance = Native.GetModuleHandle(null);

        _msgWnd = CreateMessageWindow(hInstance);
        if (_msgWnd == IntPtr.Zero)
            return 1;

        SetHotkey(Native.MOD_ALT, 0x78); // Alt+F9
        CreateTrayIcon(hInstance);

        StdioIpc.Start(ProcessCommand);
        Native.SetTimer(_msgWnd, new IntPtr(999), 200, IntPtr.Zero);

        MSG msg;
        int ret;
        while ((ret = GetMessage(&msg, IntPtr.Zero, 0, 0)) != 0)
        {
            if (ret == -1) break;
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        CleanupAll();
        RemoveTrayIcon();
        return 0;
    }

    private static void SetHotkey(uint mods, uint vk)
    {
        if (_hotkeyActive)
        {
            Native.UnregisterHotKey(_msgWnd, Native.HOTKEY_ID);
            _hotkeyActive = false;
        }
        _hotkeyMods = mods;
        _hotkeyVk = vk;
        if (vk != 0)
        {
            _hotkeyActive = Native.RegisterHotKey(_msgWnd, Native.HOTKEY_ID,
                mods | Native.MOD_NOREPEAT, vk);
        }
    }

    private static IntPtr CreateMessageWindow(IntPtr hInstance)
    {
        const string className = "PinManMsgWnd";
        fixed (char* cn = className)
        {
            var wc = new WNDCLASSEX
            {
                cbSize = (uint)sizeof(WNDCLASSEX),
                lpfnWndProc = &MsgWndProc,
                hInstance = hInstance,
                lpszClassName = cn
            };
            RegisterClassEx(ref wc);
            return Native.CreateWindowEx(0, className, "PinMan",
                Native.WS_POPUP, 0, 0, 0, 0,
                IntPtr.Zero, IntPtr.Zero, hInstance, null);
        }
    }

    [UnmanagedCallersOnly]
    private static IntPtr MsgWndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam)
    {
        switch (msg)
        {
            case Native.WM_HOTKEY:
                if (wParam == Native.HOTKEY_ID) {
                    ToggleForeground();
                }
                return IntPtr.Zero;
            case Native.WM_DESTROY:
                PostQuitMessage(0);
                return IntPtr.Zero;
            case Native.TRAY_CALLBACK:
                HandleTrayMessage(lParam);
                return IntPtr.Zero;
            case Native.WM_TIMER:
                if (wParam == new IntPtr(999))
                {
                    if (StdioIpc.Poll())
                    {
                        Native.KillTimer(_msgWnd, new IntPtr(999));
                        Native.PostMessage(_msgWnd, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    }
                    ReassertSelfTopmost();
                }
                return IntPtr.Zero;
        }
        return DefWindowProc(hWnd, msg, wParam, lParam);
    }

    private static void ToggleForeground()
    {
        IntPtr fg = Native.GetForegroundWindow();
        if (fg == IntPtr.Zero || fg == _msgWnd) return;

        if (_pins.TryRemove(fg, out var existing))
        {
            UnpinInternal(existing);
            EmitEventUnpinned(fg);
        }
        else if (_pins.Count >= _maxPins)
        {
            Console.Error.WriteLine($"@PINMAN_EVENT maxpins {{\"max\":{_maxPins}}}");
        }
        else
        {
            PinWindow(fg);
            EmitEventPinned(fg);
        }
        ReassertSelfTopmost();
    }

    /// <summary>Pin a specific window by hwnd (used for programmatic pin from Electron).</summary>
    private static string PinByHwnd(IntPtr hwnd)
    {
        if (_pins.ContainsKey(hwnd)) return "OK already pinned";
        if (_pins.Count >= _maxPins) return $"ERR max={_maxPins}";
        PinWindow(hwnd);
        EmitEventPinned(hwnd);
        ReassertSelfTopmost();
        return "OK";
    }

    private static void EmitEventPinned(IntPtr hwnd)
    {
        string title = JsonEsc(Native.GetWindowTitle(hwnd));
        Console.Error.WriteLine($"@PINMAN_EVENT pinned {{\"hwnd\":{hwnd.ToInt64()},\"title\":\"{title}\"}}");
    }
    private static void EmitEventUnpinned(IntPtr hwnd)
    {
        string title = JsonEsc(Native.GetWindowTitle(hwnd));
        Console.Error.WriteLine($"@PINMAN_EVENT unpinned {{\"hwnd\":{hwnd.ToInt64()},\"title\":\"{title}\"}}");
    }

    private static void PinWindow(IntPtr hwnd)
    {
        if (!Native.IsWindow(hwnd)) return;
        Native.SetWindowPos(hwnd, Native.HWND_TOPMOST, 0, 0, 0, 0,
            Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
        var entry = new PinEntry(hwnd, IntPtr.Zero);
        _pins[hwnd] = entry;
    }

    private static void UnpinInternal(PinEntry entry)
    {
        if (entry.Destroyed) return;
        entry.Destroyed = true;
        if (Native.IsWindow(entry.TargetHwnd))
            Native.SetWindowPos(entry.TargetHwnd, Native.HWND_NOTOPMOST, 0, 0, 0, 0,
                Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
    }

    private static void UnpinByHwnd(IntPtr hwnd)
    {
        if (_pins.TryRemove(hwnd, out var entry))
        {
            UnpinInternal(entry);
            ReassertSelfTopmost();
        }
    }

    private static void UnpinAll()
    {
        foreach (var kv in _pins) { _pins.TryRemove(kv.Key, out _); UnpinInternal(kv.Value); }
        ReassertSelfTopmost();
    }

    private static void CleanupAll()
    {
        foreach (var kv in _pins) UnpinInternal(kv.Value);
        _pins.Clear();
    }

    /// <summary>When _topmostSelf is on, re-assert our own window on top of all HWND_TOPMOST windows.</summary>
    private static void ReassertSelfTopmost()
    {
        if (!_topmostSelf || _selfHwnd == IntPtr.Zero) return;
        if (!_pins.ContainsKey(_selfHwnd)) return;
        if (!Native.IsWindow(_selfHwnd)) return;
        Native.SetWindowPos(_selfHwnd, Native.HWND_TOPMOST, 0, 0, 0, 0,
            Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE);
    }

    // ---- Balloon notification (replaces border visual feedback) ----


    private static void CreateTrayIcon(IntPtr hInstance)
    {
        _trayIcon = CreateSimpleIcon(hInstance);
        var nid = new Native.NOTIFYICONDATA
        {
            cbSize = Marshal.SizeOf<Native.NOTIFYICONDATA>(),
            hWnd = _msgWnd, uID = 1,
            uFlags = Native.NIF_MESSAGE | Native.NIF_ICON | Native.NIF_TIP,
            uCallbackMessage = Native.TRAY_CALLBACK,
            hIcon = _trayIcon, szTip = "PinMan"
        };
        Native.Shell_NotifyIcon(Native.NIM_ADD, ref nid);
    }

    private static void RemoveTrayIcon()
    {
        var nid = new Native.NOTIFYICONDATA
        { cbSize = Marshal.SizeOf<Native.NOTIFYICONDATA>(), hWnd = _msgWnd, uID = 1 };
        Native.Shell_NotifyIcon(Native.NIM_DELETE, ref nid);
        if (_trayIcon != IntPtr.Zero) DestroyIcon(_trayIcon);
    }

    private static void HandleTrayMessage(IntPtr lParam)
    {
        uint msg = unchecked((uint)(lParam.ToInt64() & 0xFFFFFFFF));
        if (msg == Native.WM_LBUTTONDBLCLK) ToggleForeground();
    }

    // ---- IPC ----

    private static string ProcessCommand(string cmd)
    {
        var parts = cmd.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "ERR empty";
        string name = parts[0].ToUpper();
        string? arg = parts.Length > 1 ? parts[1] : null;
        try
        {
            switch (name)
            {
                case "PING": return "PONG";
                case "TOGGLE": ToggleForeground(); return "OK";
                case "PIN":
                    if (arg != null && long.TryParse(arg, out long phv) && phv != 0)
                        return PinByHwnd(new IntPtr(phv));
                    return "ERR invalid hwnd";
                case "UNPIN":
                    if (arg != null && long.TryParse(arg, out long uhv))
                    { UnpinByHwnd(new IntPtr(uhv)); return "OK"; }
                    return "ERR invalid hwnd";
                case "UNPINALL": UnpinAll(); return "OK";
                case "STATUS": return BuildStatus();
                case "CONFIG": return HandleConfig(arg ?? "");
                case "SHUTDOWN":
                    Native.PostMessage(_msgWnd, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    return "OK";
                default: return $"ERR {name}";
            }
        }
        catch (Exception ex) { return $"ERR {ex.Message}"; }
    }

    private static string HandleConfig(string arg)
    {
        var kv = arg.Split('=', 2);
        if (kv.Length != 2) return "ERR format";
        string key = kv[0].Trim().ToUpper();
        string val = kv[1].Trim();
        switch (key)
        {
            case "MAXPINS":
                if (int.TryParse(val, out int mp) && mp >= 1 && mp <= 100) { _maxPins = mp; return "OK"; }
                return "ERR maxPins 1-100";
            case "HOTKEY": return SetHotkeyFromConfig(val);
            case "TOPMOSTSELF":
                _topmostSelf = val == "1";
                if (_topmostSelf) ReassertSelfTopmost();
                return "OK";
            case "SELFHWND":
                if (long.TryParse(val, out long sh) && sh != 0) { _selfHwnd = new IntPtr(sh); return "OK"; }
                return "ERR invalid hwnd";
            default: return $"ERR {key}";
        }
    }

    private static string SetHotkeyFromConfig(string arg)
    {
        uint mods = 0, vk = 0;
        var tokens = arg.Split('+', StringSplitOptions.TrimEntries);
        for (int i = 0; i < tokens.Length; i++)
        {
            if (i == tokens.Length - 1) vk = Native.VkFromName(tokens[i]);
            else mods |= Native.ModFromName(tokens[i]);
        }
        if (vk == 0) return "ERR key";
        if (mods == 0) return "ERR modifier";
        SetHotkey(mods, vk);
        return _hotkeyActive ? "OK" : $"ERR {Marshal.GetLastWin32Error()}";
    }

    private static string BuildStatus()
    {
        var sb = new System.Text.StringBuilder();
        sb.Append("OK {\"pinned\":"); sb.Append(_pins.Count);
        sb.Append(",\"maxPins\":"); sb.Append(_maxPins);
        sb.Append(",\"hotkeyActive\":"); sb.Append(_hotkeyActive ? "true" : "false");
        sb.Append(",\"topmostSelf\":"); sb.Append(_topmostSelf ? "true" : "false");
        sb.Append(",\"selfHwnd\":"); sb.Append(_selfHwnd.ToInt64());
        sb.Append(",\"windows\":[");
        bool first = true;
        foreach (var kv in _pins)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append("{\"hwnd\":"); sb.Append(kv.Key.ToInt64());
            sb.Append(",\"title\":\""); sb.Append(JsonEsc(Native.GetWindowTitle(kv.Key)));
            sb.Append("\"}");
        }
        sb.Append("]}");
        return sb.ToString();
    }

    private static string JsonEsc(string s)
    {
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (char c in s)
        {
            switch (c)
            {
                case '\\': sb.Append("\\\\"); break;
                case '\"': sb.Append("\\\""); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                case '\b': sb.Append("\\b"); break;
                case '\f': sb.Append("\\f"); break;
                default:
                    if (char.IsControl(c))
                        sb.Append($"\\u{(int)c:X4}");
                    else
                        sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }
    private static string Trunc(string s, int max) => s.Length <= max ? s : s[..(max - 3)] + "...";

    private static IntPtr CreateSimpleIcon(IntPtr hInstance)
    {
        int w = 32, h = 32;
        IntPtr hdc = Native.GetDC(IntPtr.Zero);
        IntPtr memDC = CreateCompatibleDC(hdc);
        IntPtr bmp = CreateCompatibleBitmap(hdc, w, h);
        IntPtr oldBmp = SelectObject(memDC, bmp);
        var rc = new Native.RECT { left = 0, top = 0, right = w, bottom = h };
        IntPtr bgBrush = Native.CreateSolidBrush(0x00FFFFFF);
        Native.FillRect(memDC, ref rc, bgBrush); Native.DeleteObject(bgBrush);
        IntPtr pinBrush = Native.CreateSolidBrush(0x000000FF);
        SelectObject(memDC, GetStockObject(5));
        SelectObject(memDC, pinBrush);
        Ellipse(memDC, 4, 4, w - 4, h - 8);
        POINT[] tri = { new() { x = 10, y = h - 8 }, new() { x = w - 10, y = h - 8 }, new() { x = w / 2, y = h - 2 } };
        Polygon(memDC, tri, 3);
        Native.DeleteObject(pinBrush);
        var ii = new ICONINFO { fIcon = true };
        ii.hbmMask = CreateCompatibleBitmap(hdc, w, h);
        ii.hbmColor = bmp;
        IntPtr icon = CreateIconIndirect(ref ii);
        Native.DeleteObject(ii.hbmMask);
        SelectObject(memDC, oldBmp); Native.DeleteObject(bmp);
        DeleteDC(memDC); Native.ReleaseDC(IntPtr.Zero, hdc);
        return icon;
    }

    [DllImport("gdi32.dll")] private static extern IntPtr GetStockObject(int n);
    [DllImport("gdi32.dll")] private static extern bool Ellipse(IntPtr hdc, int l, int t, int r, int b);
    [DllImport("gdi32.dll")] private static extern bool Polygon(IntPtr hdc, POINT[] apt, int cpt);
    [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int cx, int cy);
    [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr hdc, IntPtr h);
    [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr hdc);
    [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr hIcon);
    [DllImport("user32.dll")] private static extern IntPtr CreateIconIndirect(ref ICONINFO ii);

    [StructLayout(LayoutKind.Sequential)] private struct ICONINFO
    { public bool fIcon; public int xHotspot, yHotspot; public IntPtr hbmMask, hbmColor; }
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)] private struct MSG
    { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }

    [DllImport("user32.dll")] private static extern int GetMessage(MSG* lpMsg, IntPtr hWnd, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(MSG* lpMsg);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(MSG* lpMsg);
    [DllImport("user32.dll")] private static extern void PostQuitMessage(int n);
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern ushort RegisterClassEx(ref WNDCLASSEX lpwcx);
    [DllImport("user32.dll")] private static extern IntPtr DefWindowProc(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct WNDCLASSEX
    {
        public uint cbSize; public uint style;
        public unsafe delegate* unmanaged<IntPtr, uint, IntPtr, IntPtr, IntPtr> lpfnWndProc;
        public int cbClsExtra; public int cbWndExtra; public IntPtr hInstance;
        public IntPtr hIcon; public IntPtr hCursor; public IntPtr hbrBackground;
        public char* lpszMenuName; public char* lpszClassName; public IntPtr hIconSm;
    }
}
