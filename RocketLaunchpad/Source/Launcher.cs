using System.Diagnostics;
using System.IO;

namespace RocketLaunchpad;

public class Launcher
{
    public static async void LaunchGame(Account account)
    {
        Console.WriteLine($"Launching game as {account.Username}");
        var authPw = await AccountLogin.GetAuthPassword(account);
        if (authPw == null) throw new Exception("Getting Auth Password failed");
        Console.WriteLine($"Auth Password obtained: {authPw}");

        var fileName = @"E:\Jeux\rocketleague\Binaries\Win64\RocketLeague.exe";
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
}