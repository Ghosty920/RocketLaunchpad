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
        if (File.Exists(Config.Instance.LaunchPath)) return;

        MessageBox.Show("You must specify where RocketLeague.exe is located to use Rocket Launchpad.",
            "Rocket Launchpad", MessageBoxButton.OK, MessageBoxImage.Information);
        HarassUser();
    }

    private void HarassUser()
    {
        var dialog = new OpenFileDialog
        {
            Filter = "RocketLeague.exe|RocketLeague.exe",
            Title = "Select RocketLeague.exe",
        };
        var completed = dialog.ShowDialog();
        if (completed != true)
        {
            MessageBox.Show("You must specify where RocketLeague.exe is located to use Rocket Launchpad. Exiting...",
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

        Console.WriteLine("Set RocketLeague.exe path to: " + path);
        Config.Instance.LaunchPath = path;
        Config.Save();
    }

    private string RocketLeaguePath()
    {
        var path = @"C:\Program Files\Epic Games\RocketLeague\Binaries\Win64\RocketLeague.exe";
        if (File.Exists(path)) return path;
        path = @"C:\Program Files (x86)\Steam\steamapps\common\rocketleague\Binaries\Win64\RocketLeague.exe";
        if (File.Exists(path)) return path;
        return "";
    }
}