using System.Diagnostics;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Windows.Controls;

namespace RocketLauncher;

public class AccountLogin
{
    public static async Task<Account?> RegisterAccount(TextBlock textBlock)
    {
        textBlock.Text = "Getting task...";

        HttpClient client = new HttpClient();
        client.DefaultRequestHeaders.Add("User-Agent", "RocketLauncher/1.0");
        client.DefaultRequestHeaders.Add("Accept", "application/json");

        var content = new StringContent($"prompt=login&client_id={Utils.OtherClientId}", Encoding.UTF8,
            "application/x-www-form-urlencoded");
        var response = await client.PostAsync("https://api.epicgames.dev/epic/oauth/v2/deviceAuthorization", content);
        if (response.StatusCode != System.Net.HttpStatusCode.OK)
            throw new Exception("Device Authorization Network Error: " + response.StatusCode);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        var deviceCode = json.GetProperty("device_code").GetString();
        var verificationUrl = json.GetProperty("verification_uri_complete").GetString();
        var interval = json.GetProperty("interval").GetInt32();
        var expiresIn = json.GetProperty("expires_in").GetInt32();

        Process.Start(new ProcessStartInfo { FileName = verificationUrl, UseShellExecute = true });

        textBlock.Text = $"Opened page in browser";

        client.DefaultRequestHeaders.Add("Authorization",
            "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes($"{Utils.OtherClientId}:{Utils.OtherSecret}")));

        var elapsed = 0;
        while (elapsed < expiresIn)
        {
            await Task.Delay(interval * 1000);
            elapsed += interval;
            var account = await VerifyToken(client, textBlock, deviceCode);
            if (account == null) continue;
            return account;
        }

        return null;
    }

    private static async Task<Account?> VerifyToken(HttpClient client, TextBlock textBlock, string deviceCode)
    {
        var content = new StringContent($"grant_type=device_code&device_code={deviceCode}", Encoding.UTF8,
            "application/x-www-form-urlencoded");
        var response = await client.PostAsync("https://api.epicgames.dev/epic/oauth/v2/token", content);
        if (response.StatusCode != System.Net.HttpStatusCode.OK) return null;
        textBlock.Text = "Getting account (1/3)";

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var accountId = json.GetProperty("account_id").GetString();
        var accessToken = json.GetProperty("access_token").GetString();
        var accessExpires = Utils.ParseDate(json.GetProperty("expires_at").GetString());
        var refreshToken = json.GetProperty("refresh_token").GetString();
        var refreshExpires = Utils.ParseDate(json.GetProperty("refresh_expires_at").GetString());

        var account = await GetAccountData(client, textBlock, accountId, accessToken);
        account.EpicAccessToken = accessToken;
        account.EpicAccessExpiresAt = accessExpires;
        account.EpicRefreshToken = refreshToken;
        account.EpicRefreshExpiresAt = refreshExpires;
        return account;
    }

    private static async Task<Account> GetAccountData(HttpClient client, TextBlock textBlock, string accountId, string accessToken)
    {
        var payload = Utils.FixBase64(accessToken.Split('.')[1]);
        var accJson = JsonDocument.Parse(Convert.FromBase64String(payload));
        var jti = accJson.RootElement.GetProperty("jti").GetString();
        
        var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://account-public-service-prod.ol.epicgames.com/account/api/public/account/{accountId}/deviceAuth");
        request.Headers.Add("Authorization", $"Bearer {jti}");

        var content = new StringContent("", Encoding.UTF8, "application/json");
        request.Content = content;
        var response = await client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK)
            throw new Exception("Device Authorization Network Error: " + response.StatusCode);
        textBlock.Text = "Getting account (2/3)";

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var deviceId = json.GetProperty("deviceId").GetString();
        var secret = json.GetProperty("secret").GetString();

        var account = await GetAccountToken(client, textBlock, accountId, deviceId, secret);
        account.AccountId = accountId;
        account.AuthDeviceId = deviceId;
        account.AuthSecret = secret;
        return account;
    }

    private static async Task<Account> GetAccountToken(HttpClient client, TextBlock textBlock, string accountId,
        string deviceId, string secret)
    {
        var token = Convert.ToBase64String(Encoding.UTF8.GetBytes(Utils.OtherClientId + ":" + Utils.OtherSecret));
        var content =
            $"grant_type=device_auth&device_id={deviceId}&account_id={accountId}&secret={secret}&token_type=eg1";
        var res = await GetOauthToken(client, token, content);
        if (res == null)
            throw new Exception("Token Error");
        textBlock.Text = "Getting account (3/3)";

        var json = res.Value;
        var displayName = json.GetProperty("displayName").GetString();
        var accessToken = json.GetProperty("access_token").GetString();
        var accessExpires = Utils.ParseDate(json.GetProperty("expires_at").GetString());
        var refreshToken = json.GetProperty("refresh_token").GetString();
        var refreshExpires = Utils.ParseDate(json.GetProperty("refresh_expires_at").GetString());

        var account = new Account
        {
            Username = displayName,
            AccAccessToken = accessToken,
            AccAccessExpiresAt = accessExpires,
            AccRefreshToken = refreshToken,
            AccRefreshExpiresAt = refreshExpires
        };
        return account;
    }

    public static async Task<string?> GetAuthPassword(Account account)
    {
        HttpClient client = new HttpClient();
        client.DefaultRequestHeaders.Add("User-Agent", "RocketLauncher/1.0");
        client.DefaultRequestHeaders.Add("Accept", "application/json");

        if (Utils.Expired(account.AccAccessExpiresAt))
        {
            return null;
        }

        var exchangeCode = await GetOauthExchange(client, account.AccAccessToken);
        if (exchangeCode == null) return null;
       
        var tokenContent = $"grant_type=exchange_code&exchange_code={exchangeCode}";
        var token = await GetOauthToken(client, Utils.FNAuth, tokenContent);
        if(token == null) return null;
        
        var accToken = token.Value.GetProperty("access_token").GetString();
        var authPassword = await GetOauthExchange(client, accToken);
        return authPassword;
    }

    private static async Task<JsonElement?> GetOauthToken(HttpClient client, string token, string content)
    {
        var request = new HttpRequestMessage(HttpMethod.Post,
            "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token");
        request.Headers.Add("Authorization", $"Basic {token}");
        request.Content = new StringContent(content, Encoding.UTF8, "application/x-www-form-urlencoded");
        var response = await client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK)
            return null;
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return json;
    }

    private static async Task<string?> GetOauthExchange(HttpClient client, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get,
            "https://account-public-service-prod.ol.epicgames.com/account/api/oauth/exchange");
        request.Headers.Add("Authorization", $"Bearer {token}");
        request.Content = new StringContent("", Encoding.UTF8, "application/json");
        var response = await client.SendAsync(request);
        if (response.StatusCode != System.Net.HttpStatusCode.OK)
            return null;
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        return json.GetProperty("code").GetString();
    }
}

/*
"E:/Jeux/rocketleague/Binaries/Win64/RocketLeague.exe"  
    -AUTH_LOGIN=unused 
    -AUTH_PASSWORD=0f718d1e08ef40e9b4d779c0b68a553e 
    -AUTH_TYPE=exchangecode 
    -epicapp=Sugar 
    -epicenv=Prod 
    -EpicPortal 
    -language=INT 
    -epicusername="Ghost?y" 
    -epicuserid=9b24c7c2c10848a8aee1ba5caf87f597 
    -epiclocale=fr 
    -epicsandboxid=9773aa1aa54f4f7b80e44bef04986cea
*/