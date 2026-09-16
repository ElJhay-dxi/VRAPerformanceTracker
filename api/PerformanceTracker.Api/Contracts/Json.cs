using System.Text.Json;
using System.Text.Json.Serialization;

namespace PerformanceTracker.Api.Contracts;

/// Serializer options for payloads we build by hand (e.g. archive snapshots),
/// matched to what the HTTP pipeline emits: camelCase, enums as strings.
public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };
}
