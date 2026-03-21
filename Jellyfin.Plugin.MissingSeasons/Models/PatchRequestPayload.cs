using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.MissingSeasons.Models;

/// <summary>
/// Payload used by the FileTransformation plugin callback.
/// </summary>
public class PatchRequestPayload
{
    /// <summary>
    /// Gets or sets the file contents to transform.
    /// </summary>
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
