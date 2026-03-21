using System.Reflection;
using System.Text.RegularExpressions;
using Jellyfin.Plugin.MissingSeasons.Models;

namespace Jellyfin.Plugin.MissingSeasons.Helpers;

/// <summary>
/// Injects the Missing Seasons client script into the Jellyfin web interface index.html.
/// </summary>
public static partial class IndexHtmlInjector
{
    private const string ScriptTagPattern = "<script plugin=\"MissingSeasons\".*?></script>";

    /// <summary>
    /// FileTransformation plugin callback that transforms index.html contents
    /// to include the Missing Seasons script tag.
    /// </summary>
    public static string FileTransformer(PatchRequestPayload payload)
    {
        string scriptElement = GetScriptElement();
        string indexContents = payload.Contents!;

        // Remove any old script tag first
        indexContents = OldScriptTagRegex().Replace(indexContents, string.Empty);

        // Inject new script tag before </body>
        indexContents = BodyCloseRegex().Replace(indexContents, $"{scriptElement}$1");

        return indexContents;
    }

    private static string GetScriptElement()
    {
        string versionTag = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0.0";
        return $"<script plugin=\"MissingSeasons\" version=\"{versionTag}\" src=\"/MissingSeasons/ClientScript\"></script>";
    }

    [GeneratedRegex("<script plugin=\"MissingSeasons\".*?></script>", RegexOptions.IgnoreCase)]
    private static partial Regex OldScriptTagRegex();

    [GeneratedRegex("(</body>)", RegexOptions.IgnoreCase)]
    private static partial Regex BodyCloseRegex();
}
