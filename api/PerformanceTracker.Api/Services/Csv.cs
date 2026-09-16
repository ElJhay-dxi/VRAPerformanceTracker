using System.Text;

namespace PerformanceTracker.Api.Services;

/// Tiny hand-rolled CSV writer — the exports are small, controlled tables, so a
/// dependency for this isn't worth the bundle/package weight.
public static class Csv
{
    public static string Field(object? value)
    {
        var s = value?.ToString() ?? "";
        return s.Contains(',') || s.Contains('"') || s.Contains('\n') || s.Contains('\r')
            ? "\"" + s.Replace("\"", "\"\"") + "\""
            : s;
    }

    public static string Row(params object?[] values) => string.Join(",", values.Select(Field));

    public static byte[] Bytes(string csv) => Encoding.UTF8.GetBytes(csv);
}
