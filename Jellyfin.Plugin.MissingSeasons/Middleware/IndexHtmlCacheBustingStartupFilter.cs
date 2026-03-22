using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace Jellyfin.Plugin.MissingSeasons.Middleware;

/// <summary>
/// Startup filter that directly injects the Missing Seasons client script into
/// index.html responses. This approach does not depend on the FileTransformation
/// plugin, making the plugin fully self-contained.
///
/// It also strips conditional request headers to prevent 304 responses and
/// sets Cache-Control: no-store so browsers always receive the patched HTML.
/// </summary>
public class IndexHtmlCacheBustingStartupFilter : IStartupFilter
{
    private static readonly string InjectedScriptTag = BuildScriptTag();

    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(async (context, nextMiddleware) =>
            {
                var path = context.Request.Path.Value;
                if (path is null || !path.EndsWith("index.html", StringComparison.OrdinalIgnoreCase))
                {
                    await nextMiddleware();
                    return;
                }

                // Strip conditional request headers so the static file middleware
                // always returns 200 with the full response body.
                context.Request.Headers.Remove("If-Modified-Since");
                context.Request.Headers.Remove("If-None-Match");

                // Strip Accept-Encoding so the static file middleware returns an
                // uncompressed body that we can read and modify as plain text.
                context.Request.Headers.Remove("Accept-Encoding");

                // Capture the downstream response body in memory so we can inject
                // the script tag before forwarding to the client.
                var originalBody = context.Response.Body;
                using var buffer = new MemoryStream();
                context.Response.Body = buffer;

                await nextMiddleware();

                // Only modify successful HTML responses.
                if (context.Response.StatusCode == 200)
                {
                    buffer.Position = 0;
                    var content = await new StreamReader(buffer, Encoding.UTF8).ReadToEndAsync();

                    // Remove any stale MissingSeasons script tag (e.g. from FileTransformation).
                    content = Regex.Replace(
                        content,
                        @"<script\s+plugin=""MissingSeasons""[^>]*></script>",
                        string.Empty,
                        RegexOptions.IgnoreCase);

                    // Inject our script tag immediately before </body>.
                    content = Regex.Replace(
                        content,
                        @"(</body>)",
                        InjectedScriptTag + "$1",
                        RegexOptions.IgnoreCase);

                    var bytes = Encoding.UTF8.GetBytes(content);

                    // Restore the original stream and write the modified response.
                    context.Response.Body = originalBody;
                    context.Response.ContentLength = bytes.Length;
                    context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
                    context.Response.Headers.Remove("Last-Modified");
                    context.Response.Headers.Remove("ETag");

                    await originalBody.WriteAsync(bytes);
                }
                else
                {
                    // Non-200: pass the captured bytes through unchanged.
                    buffer.Position = 0;
                    context.Response.Body = originalBody;
                    await buffer.CopyToAsync(originalBody);
                }
            });

            next(app);
        };
    }

    private static string BuildScriptTag()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0.0";
        return $"<script plugin=\"MissingSeasons\" version=\"{version}\" src=\"/MissingSeasons/ClientScript\"></script>";
    }
}
