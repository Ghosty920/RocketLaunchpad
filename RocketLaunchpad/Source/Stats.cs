using System.Net.Http;
using System.Text.Json;
using static RocketLaunchpad.Utils;

namespace RocketLaunchpad;

public static class Stats
{
    public static async Task<JsonElement?> GetStats(String username)
    {
        var request =
            new HttpRequestMessage(HttpMethod.Post, "http://localhost:3000/" + Uri.EscapeDataString(username));

        var response = await Client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK)
            return null;

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return json;
    }
}