using System.Buffers;
using System.Text;
using System.Text.Json;

namespace AppStats;

internal sealed class StatsStore
{
    private readonly string _path;
    private readonly Dictionary<string, Dictionary<string, double>> _days = new(StringComparer.Ordinal);
    private bool _dirty;

    public StatsStore(string path)
    {
        _path = path;
        Load();
    }

    public void AddUsage(string processName, double seconds)
    {
        if (seconds <= 0) return;
        string day = DateTime.Now.ToString("yyyy-MM-dd");
        if (!_days.TryGetValue(day, out var apps))
        {
            apps = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
            _days[day] = apps;
        }
        apps[processName] = apps.GetValueOrDefault(processName) + seconds;
        _dirty = true;
    }

    public void Clear()
    {
        _days.Clear();
        _dirty = true;
        Save();
    }

    public void Save()
    {
        if (!_dirty) return;
        string? directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
        string temp = _path + ".tmp";
        using (var stream = File.Create(temp))
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = false }))
        {
            writer.WriteStartObject();
            writer.WriteNumber("version", 1);
            writer.WriteStartObject("days");
            foreach (var day in _days.OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                writer.WriteStartObject(day.Key);
                foreach (var app in day.Value.OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase))
                    writer.WriteNumber(app.Key, Math.Round(app.Value, 1));
                writer.WriteEndObject();
            }
            writer.WriteEndObject();
            writer.WriteEndObject();
        }
        File.Move(temp, _path, true);
        _dirty = false;
    }

    public string Snapshot(string? activeProcess, bool isAfk, int afkThresholdSec)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("today", DateTime.Now.ToString("yyyy-MM-dd"));
            if (activeProcess is null) writer.WriteNull("activeProcess");
            else writer.WriteString("activeProcess", activeProcess);
            writer.WriteBoolean("isAfk", isAfk);
            writer.WriteNumber("afkThresholdSec", afkThresholdSec);
            writer.WriteStartObject("days");
            foreach (var day in _days.OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                writer.WriteStartObject(day.Key);
                foreach (var app in day.Value.OrderByDescending(x => x.Value).ThenBy(x => x.Key, StringComparer.OrdinalIgnoreCase))
                    writer.WriteNumber(app.Key, Math.Round(app.Value, 1));
                writer.WriteEndObject();
            }
            writer.WriteEndObject();
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    private void Load()
    {
        if (!File.Exists(_path)) return;
        try
        {
            using JsonDocument document = JsonDocument.Parse(File.ReadAllBytes(_path));
            if (!document.RootElement.TryGetProperty("days", out var days)) return;
            foreach (var day in days.EnumerateObject())
            {
                var apps = new Dictionary<string, double>(StringComparer.OrdinalIgnoreCase);
                foreach (var app in day.Value.EnumerateObject())
                {
                    if (app.Value.TryGetDouble(out double value) && value > 0) apps[app.Name] = value;
                }
                _days[day.Name] = apps;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"@APPSTATS_LOG warn Failed to load persistence: {Escape(ex.Message)}");
        }
    }

    private static string Escape(string value) => value.Replace("\r", "\\r").Replace("\n", "\\n");
}
