using System.Net.Http;
using System.Text;
using System.Text.Json;
using static RocketLaunchpad.Utils;

namespace RocketLaunchpad;

public static class AccountLogin
{
    public static async Task<JsonElement?> StartDeviceAuthentication()
    {
        var request = new HttpRequestMessage(HttpMethod.Post,
            "https://api.epicgames.dev/epic/oauth/v2/deviceAuthorization");
        request.Content = new StringContent($"prompt=login&client_id={AuthClientId}", Encoding.UTF8,
            "application/x-www-form-urlencoded");
        
        var response = await Client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK) return null;
        
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return json;
    }

    /// <summary>
    /// Verify is the device authentication has been completed by the user,
    /// and if so, updates the account's AccountId field,
    /// and returns the Epic access token as well.
    /// </summary>
    /// <param name="account">The account to update.</param>
    /// <param name="deviceCode">The device code the user was sent.</param>
    /// <returns>If authenticated, the Epic access token, otherwise null.</returns>
    public static async Task<string?> VerifyDeviceToken(Account account, string deviceCode)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.epicgames.dev/epic/oauth/v2/token");
        request.Headers.Add("Authorization", $"Basic {AuthToken}");
        request.Content = new StringContent($"grant_type=device_code&device_code={deviceCode}", Encoding.UTF8,
            "application/x-www-form-urlencoded");

        var response = await Client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK) return null;

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        account.AccountId = json.GetProperty("account_id").GetString()!;
        return json.GetProperty("access_token").GetString();
    }

    /// <summary>
    /// Updates the account data using device auth.
    /// It will update the AuthDeviceId and AuthSecret fields.
    /// </summary>
    /// <param name="account">The account to update.</param>
    /// <param name="accessToken">The Epic access token to use.</param>
    public static async Task GetDeviceAuth(Account account, string accessToken)
    {
        if (account.AccountId is null) throw new NullReferenceException("No account id");

        // extract the jti from the access token as it's the authorization token
        var payload = FixBase64(accessToken.Split('.')[1]);
        var accJson = JsonDocument.Parse(Convert.FromBase64String(payload));
        var jti = accJson.RootElement.GetProperty("jti").GetString();

        // then the usual stuff
        var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://account-public-service-prod.ol.epicgames.com/account/api/public/account/{account.AccountId}/deviceAuth");
        request.Headers.Add("Authorization", $"Bearer {jti}");

        var response = await Client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK)
            throw new Exception("Device Authorization Network Error: " + response.StatusCode);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        account.AuthDeviceId = json.GetProperty("deviceId").GetString()!;
        account.AuthSecret = json.GetProperty("secret").GetString()!;
    }

    /// <summary>
    /// Updates the account data using device auth.
    /// It will update the Username, EpicAccess and EpicRefresh fields.
    /// </summary>
    /// <param name="account">The account to update.</param>
    public static async Task UseDeviceAuth(Account account)
    {
        if (account.AccountId is null) throw new NullReferenceException("Account id is null");
        if (account.AuthDeviceId is null) throw new NullReferenceException("Device id is null");
        if (account.AuthSecret is null) throw new NullReferenceException("Secret is null");

        var content =
            $"grant_type=device_auth&device_id={account.AuthDeviceId}&account_id={account.AccountId}&secret={account.AuthSecret}&token_type=eg1";
        var res = await LoginUtils.GetOauthToken(AuthToken, content);
        if (res is null) throw new Exception("Oauth Token request failed");

        account.Username = res?.GetProperty("displayName").GetString()!;
        account.AccessToken = res?.GetProperty("access_token").GetString()!;
        account.AccessExpiresAt = ParseDate(res?.GetProperty("expires_at").GetString()!);
        account.RefreshToken = res?.GetProperty("refresh_token").GetString()!;
        account.RefreshExpiresAt = ParseDate(res?.GetProperty("refresh_expires_at").GetString()!);
    }
}