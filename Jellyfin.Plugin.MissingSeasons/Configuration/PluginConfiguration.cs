using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.MissingSeasons.Configuration;

/// <summary>
/// Plugin configuration for Missing Seasons.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets a value indicating whether available seasons are shown before missing ones.
    /// When enabled, seasons present in the library appear first, followed by missing seasons.
    /// </summary>
    public bool ShowAvailableSeasonsFirst { get; set; } = false;
}
