using System.Diagnostics;
using System.IO;

namespace RocketLauncher;

public class Launcher
{
    public static void LaunchGame(Account account)
    {
        var authPw = AccountLogin.GetAuthPassword(account);
        if(authPw == null) throw new Exception("Getting Auth Password failed");
        Console.WriteLine($"Auth Password obtained: {authPw}");

        var fileName = @"E:\Jeux\rocketleague\Binaries\Win64\RocketLeague.exe";
        Process.Start(new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = "-AUTH_LOGIN=unused " +
                        $"-AUTH_PASSWORD={authPw} " +
                        "-AUTH_TYPE=exchangecode " +
                        "-epicapp=Sugar " +
                        "-epicenv=Prod " +
                        "-EpicPortal " +
                        "-language=INT " +
                        $"-epicusername=\"{account.Username}\" " +
                        $"-epicuserid={account.AccountId} " +
                        "",
            UseShellExecute = true,
            WorkingDirectory = Path.GetDirectoryName(fileName)
        });
    }
}