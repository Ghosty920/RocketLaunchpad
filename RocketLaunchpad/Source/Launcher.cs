using System.Diagnostics;
using static RocketLaunchpad.Utils;

namespace RocketLaunchpad;

public static class Launcher
{
    public static async Task LaunchGame(Account account)
    {
        Console.WriteLine($"Launching game as {account.Username}");
        var authPw = await GetAuthPassword(account);
        if (authPw is null) throw new Exception("Getting Auth Password failed");
        Console.WriteLine($"Auth Password obtained: {authPw}");

        // TODO: Setup a way to get it manually :thumbsup:
        const string fileName = @"E:\Jeux\rocketleague\Binaries\Win64\RocketLeague.exe";

        var args =
            "-AUTH_LOGIN=unused " +
            $"-AUTH_PASSWORD={authPw} " +
            "-AUTH_TYPE=exchangecode " +
            "-epicapp=Sugar " +
            "-epicenv=Prod " +
            "-EpicPortal " +
            "-language=INT " +
            "-epicusername=\"\" " +
            $"-epicuserid={account.AccountId} ";

        Process.Start(new ProcessStartInfo
        {
            FileName = "cmd",
            Arguments = $"/c start \"\" \"{fileName}\" {args}",
            UseShellExecute = false,
            CreateNoWindow = true,
        });
    }

    private static async Task<string?> GetAuthPassword(Account account)
    {
        if (Expired(account.AccessExpiresAt))
        {
            await account.Refresh();
            if (Expired(account.AccessExpiresAt)) 
                throw new Exception("Refreshing Access Token failed");
        }

        var exchangeCode = await LoginUtils.GetOauthExchange(account.AccessToken);
        if (exchangeCode is null) return null;

        var tokenContent = $"grant_type=exchange_code&exchange_code={exchangeCode}";
        var token = await LoginUtils.GetOauthToken(AuthEglToken, tokenContent);

        var accToken = token?.GetProperty("access_token").GetString();
        if (accToken is null) return null;

        var authPassword = await LoginUtils.GetOauthExchange(accToken);
        return authPassword;
    }
}