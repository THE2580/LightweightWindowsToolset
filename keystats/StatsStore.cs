using System.Buffers;
using System.Text;
using System.Text.Json;

namespace KeyStats;

internal sealed class StatsStore
{
    private readonly string _path;
    private readonly Dictionary<string, Dictionary<string, long>> _days = new(StringComparer.Ordinal);
    private bool _dirty;

    public StatsStore(string path)
    {
        _path = path;
        Load();
    }

    public void Increment(string key)
    {
        string day = DateTime.Now.ToString("yyyy-MM-dd");
        if (!_days.TryGetValue(day, out var counts))
        {
            counts = new Dictionary<string, long>(StringComparer.Ordinal);
            _days[day] = counts;
        }
        counts[key] = counts.GetValueOrDefault(key) + 1;
        _dirty = true;
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
                foreach (var count in day.Value.OrderBy(x => x.Key, StringComparer.Ordinal))
                    writer.WriteNumber(count.Key, count.Value);
                writer.WriteEndObject();
            }
            writer.WriteEndObject();
            writer.WriteEndObject();
        }
        File.Move(temp, _path, true);
        _dirty = false;
    }

    public string Snapshot()
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("today", DateTime.Now.ToString("yyyy-MM-dd"));
            writer.WriteStartObject("days");
            foreach (var day in _days.OrderBy(x => x.Key, StringComparer.Ordinal))
            {
                writer.WriteStartObject(day.Key);
                foreach (var count in day.Value.OrderByDescending(x => x.Value).ThenBy(x => x.Key, StringComparer.Ordinal))
                    writer.WriteNumber(count.Key, count.Value);
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
                var counts = new Dictionary<string, long>(StringComparer.Ordinal);
                foreach (var count in day.Value.EnumerateObject())
                {
                    if (count.Value.TryGetInt64(out long value) && value > 0) counts[count.Name] = value;
                }
                _days[day.Name] = counts;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"@KEYSTATS_LOG warn Failed to load persistence: {Escape(ex.Message)}");
        }
    }

    private static string Escape(string value) => value.Replace("\r", "\\r").Replace("\n", "\\n");
}
