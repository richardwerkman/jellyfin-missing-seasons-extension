using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.MissingSeasons.Services;

/// <summary>
/// Scheduled task that runs on startup to register the Missing Seasons script
/// with the FileTransformation plugin for index.html injection.
/// </summary>
public class StartupService : IScheduledTask
{
    private readonly ILogger<StartupService> _logger;

    /// <inheritdoc />
    public string Name => "MissingSeasons Startup";

    /// <inheritdoc />
    public string Key => "Jellyfin.Plugin.MissingSeasons.Startup";

    /// <inheritdoc />
    public string Description => "Registers Missing Seasons script injection with FileTransformation plugin";

    /// <inheritdoc />
    public string Category => "Startup Services";

    /// <summary>
    /// Initializes a new instance of the <see cref="StartupService"/> class.
    /// </summary>
    public StartupService(ILogger<StartupService> logger)
    {
        _logger = logger;
    }

    /// <inheritdoc />
    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Missing Seasons: script injection is handled directly by the ASP.NET Core middleware. " +
            "The FileTransformation plugin is not required.");
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo
        {
            Type = TaskTriggerInfoType.StartupTrigger
        };
    }
}
