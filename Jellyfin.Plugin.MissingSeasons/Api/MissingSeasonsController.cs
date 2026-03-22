using System.Reflection;
using Jellyfin.Plugin.MissingSeasons.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.MissingSeasons.Api;

/// <summary>
/// Controller for serving the Missing Seasons client script.
/// </summary>
[ApiController]
[Route("MissingSeasons")]
public class MissingSeasonsController : ControllerBase
{
    private readonly Assembly _assembly;
    private readonly string _scriptResourcePath;

    /// <summary>
    /// Initializes a new instance of the <see cref="MissingSeasonsController"/> class.
    /// </summary>
    public MissingSeasonsController()
    {
        _assembly = Assembly.GetExecutingAssembly();
        _scriptResourcePath = $"{typeof(MissingSeasonsPlugin).Namespace}.Web.missing-seasons.js";
    }

    /// <summary>
    /// Get the client-side JavaScript for missing seasons.
    /// </summary>
    /// <response code="200">JavaScript file returned.</response>
    /// <response code="404">Script not found.</response>
    /// <returns>The missing-seasons.js embedded file.</returns>
    [HttpGet("ClientScript")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [Produces("application/javascript")]
    public ActionResult GetClientScript()
    {
        var scriptStream = _assembly.GetManifestResourceStream(_scriptResourcePath);
        if (scriptStream == null)
        {
            return NotFound();
        }

        return File(scriptStream, "application/javascript");
    }

    /// <summary>
    /// Get the plugin configuration for the client-side script.
    /// </summary>
    /// <response code="200">Configuration returned.</response>
    /// <returns>Plugin configuration as JSON.</returns>
    [HttpGet("ClientConfiguration")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Produces("application/json")]
    public ActionResult<PluginConfiguration> GetClientConfiguration()
    {
        var config = MissingSeasonsPlugin.Instance?.Configuration ?? new PluginConfiguration();
        return Ok(config);
    }
}
