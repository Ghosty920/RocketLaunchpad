using System.Diagnostics;
using System.Windows.Controls;

namespace RocketLaunchpad;

public static class AccountProcess
{
    public static async Task<Account> Login(TextBlock textBlock)
    {
        textBlock.Text = "Starting authentication...";
        var json = await AccountLogin.StartDeviceAuthentication();
        if (json is null) throw new Exception("Couldn't start authentication.");

        var deviceCode = json?.GetProperty("device_code").GetString()! ?? throw new Exception("??");
        var verificationUrl = json?.GetProperty("verification_uri_complete").GetString()! ?? throw new Exception("??");
        var interval = json?.GetProperty("interval").GetInt32()! ?? throw new Exception("??");
        var expiresIn = json?.GetProperty("expires_in").GetInt32()! ?? throw new Exception("??");

        // opens the verification url in the browser, TODO maybe ask the user to open it/copy link?
        textBlock.Text = "Confirm in your browser...";
        Process.Start(new ProcessStartInfo { FileName = verificationUrl, UseShellExecute = true });

        var account = new Account();
        
        var elapsed = 0;
        while (elapsed < expiresIn)
        {
            await Task.Delay(interval * 1000);
            elapsed += interval;
            
            var deviceToken = await AccountLogin.VerifyDeviceToken(account, deviceCode);
            if(deviceToken is null) continue;
            Console.WriteLine($"Got the account of id {account.AccountId}");
            
            textBlock.Text = "Got an account (1/3)";
            await AccountLogin.GetDeviceAuth(account, deviceToken);
            
            textBlock.Text = "Got an account (2/3)";
            await AccountLogin.UseDeviceAuth(account);
            
            textBlock.Text = "Got an account (3/3)"; // surely useless
            return account;
        }
        throw new Exception("Authentication timed out.");
    }
}