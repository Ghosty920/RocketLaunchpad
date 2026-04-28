using System.Configuration;
using System.Data;
using System.IO;
using System.Windows;
using Microsoft.Win32;

namespace RocketLaunchpad;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        Config.Load();

        if (Config.Instance.LaunchPath == "") Config.Instance.LaunchPath = RocketLeaguePath();
        if (File.Exists(Config.Instance.LaunchPath))
        {
            // check if the file name is correct
            if (Config.Instance.LaunchPath.EndsWith("RocketLeague_EAC.exe"))
                return;

            // 28th April 2026, Rocket League added EAC - try to fix the path to use it
            if (Config.Instance.LaunchPath.EndsWith("RocketLeague.exe"))
            {
                Config.Instance.LaunchPath =
                    Config.Instance.LaunchPath.Substring(0, Config.Instance.LaunchPath.Length - 4) + "_EAC.exe";
                Config.Save();
                // check if the renamed file path exists
                if(File.Exists(Config.Instance.LaunchPath)) return;
            }
            // if all checks failed, the file is prob wrong, so we'll ask for it again
        }

        MessageBox.Show("You must specify where RocketLeague_EAC.exe is located to use Rocket Launchpad.",
            "Rocket Launchpad", MessageBoxButton.OK, MessageBoxImage.Information);
        HarassUser();
    }

    private void HarassUser()
    {
        var dialog = new OpenFileDialog
        {
            Filter = "RocketLeague_EAC.exe|RocketLeague_EAC.exe",
            Title = "Select RocketLeague_EAC.exe",
        };
        var completed = dialog.ShowDialog();
        if (completed != true)
        {
            MessageBox.Show(
                "You must specify where RocketLeague_EAC.exe is located to use Rocket Launchpad. Exiting...",
                "Rocket Launchpad", MessageBoxButton.OK, MessageBoxImage.Warning);
            Shutdown();
            return;
        }

        var path = dialog.FileName;
        // if for some reason the file wouldn't exist
        if (!File.Exists(path))
        {
            var result = MessageBox.Show("The executable you specified seems invalid. Try again?", "Rocket Launchpad",
                MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (result == MessageBoxResult.Yes)
            {
                HarassUser();
                return;
            }

            Shutdown();
            return;
        }

        Console.WriteLine("Set RocketLeague_EAC.exe path to: " + path);
        Config.Instance.LaunchPath = path;
        Config.Save();
    }

    private string RocketLeaguePath()
    {
        var path = @"C:\Program Files\Epic Games\RocketLeague\Binaries\Win64\RocketLeague_EAC.exe";
        if (File.Exists(path)) return path;
        path = @"C:\Program Files (x86)\Steam\steamapps\common\rocketleague\Binaries\Win64\RocketLeague_EAC.exe";
        if (File.Exists(path)) return path;
        return "";
    }
}