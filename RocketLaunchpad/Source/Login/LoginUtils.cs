using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using static RocketLaunchpad.Utils;

namespace RocketLaunchpad;

public static class LoginUtils
{
    /// <summary>
    /// Retrieves an OAuth token using the provided HttpClient and authorization token and request body content.
    /// </summary>
    /// <param name="client">The HttpClient instance used to send the request.</param>
    /// <param name="token">The authorization token used for Basic Authentication in the request.</param>
    /// <param name="content">The request body content in x-www-form-urlencoded format.</param>
    /// <returns>
    /// A JsonElement containing the parsed JSON representation of the OAuth token if the request is successful,
    /// or null if the request fails or the response status code is not OK.
    /// </returns>
    public static async Task<JsonElement?> GetOauthToken(string token, string content)
    {
        var request = new HttpRequestMessage(HttpMethod.Post,
            "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token");
        request.Headers.Add("Authorization", $"Basic {token}");
        request.Content = new StringContent(content, Encoding.UTF8, "application/x-www-form-urlencoded");

        var response = await Client.SendAsync(request);
        if (response.StatusCode != HttpStatusCode.OK)
            throw await LoginRequestException.FromResponse(response, "Oauth Token request failed.");

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return json;
    }

    /// <summary>
    /// Retrieves an OAuth exchange code using the provided access token.
    /// </summary>
    /// <param name="token">The Access Token used in the Authorization header.</param>
    /// <returns>
    /// A string representing the OAuth exchange code if the request is successful,
    /// or null if the request fails or the response is invalid.
    /// </returns>
    public static async Task<string?> GetOauthExchange(string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get,
            "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/exchange");
        request.Headers.Add("Authorization", $"Bearer {token}");

        var response = await Client.SendAsync(request);
        if (response.StatusCode != HttpStatusCode.OK)
            throw await LoginRequestException.FromResponse(response, "Oauth Exchange request failed.");

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return json.GetProperty("code").GetString();
    }

    public class LoginRequestException : Exception
    {
        public HttpStatusCode Code { get; }
        public JsonElement? Response { get; }

        public LoginRequestException(HttpStatusCode code, JsonElement response, string message)
            : base(message)
        {
            Code = code;
            Response = response;
        }

        public LoginRequestException(HttpStatusCode code, string response, string message)
            : base(message)
        {
            Code = code;

            try
            {
                Response = JsonDocument.Parse(response).RootElement.Clone();
            }
            catch
            {
                Response = null;
            }
        }

        public static async Task<LoginRequestException> FromResponse(HttpResponseMessage response, string message)
        {
            var content = await response.Content.ReadAsStringAsync();
            return new LoginRequestException(response.StatusCode, content, message);
        }
    }
}