namespace PinMan;

internal static class StdioIpc
{
    private static Func<string, string>? _handler;

    public static void Start(Func<string, string> handler)
    {
        _handler = handler;
        Console.Error.WriteLine("@PINMAN_LOG info IPC handler initialized");
    }

    /// <summary>Poll stdin. Non-blocking.</summary>
    public static bool Poll()
    {
        if (_handler == null) return false;
        try
        {
            if (Console.In.Peek() == -1) return false;
            string? line = Console.In.ReadLine();
            if (line == null) return false;
            line = line.Trim();
            if (line.Length == 0) return false;

            string response = _handler(line);
            Console.WriteLine(response);

            if (line.StartsWith("SHUTDOWN", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"@PINMAN_LOG error IPC poll failed error=\"{ex.Message.Replace("\r", "\\r").Replace("\n", "\\n")}\"");
        }
        return false;
    }

    public static void SendToggle()
    {
        try
        {
            using var evt = new System.Threading.EventWaitHandle(false,
                System.Threading.EventResetMode.AutoReset, @"Global\PinMan_Toggle");
            evt.Set();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"@PINMAN_LOG error Toggle forwarding failed error=\"{ex.Message.Replace("\r", "\\r").Replace("\n", "\\n")}\"");
        }
    }
}
