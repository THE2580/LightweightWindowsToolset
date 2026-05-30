namespace PinMan;

internal class PinEntry
{
    public IntPtr TargetHwnd;
    public IntPtr TimerId;
    public DateTime PinnedAt;
    public bool Destroyed;

    public PinEntry(IntPtr target, IntPtr timer)
    {
        TargetHwnd = target;
        TimerId = timer;
        PinnedAt = DateTime.UtcNow;
    }
}
