using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using Microsoft.Win32;

namespace RocketLaunchpad.Components;

public partial class SettingsPage : UserControl
{
    public SettingsPage()
    {
        InitializeComponent();
        GamePath.Text = Config.Instance.LaunchPath;
        LaunchArgs.Text = Config.Instance.LaunchArgs;
    }

    private void BrowseLaunchPath_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Filter = "RocketLeague.exe|RocketLeague.exe",
            Title = "Select RocketLeague.exe",
        };
        if (dialog.ShowDialog() != true) return;

        var path = dialog.FileName;
        // if for some reason the file wouldn't exist
        if (!File.Exists(path))
        {
            MessageBox.Show("The executable you specified seems invalid.", "Rocket Launchpad",
                MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        Console.WriteLine("Set RocketLeague.exe path to: " + path);
        Config.Instance.LaunchPath = path;
        Config.Save();
        GamePath.Text = path;
    }

    private void OpenAppDataFolder_Click(object sender, RoutedEventArgs e)
    {
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "RocketLaunchpad");
        Process.Start(new ProcessStartInfo { FileName = path, UseShellExecute = true });
    }

    private void UIElement_OnLostFocus(object sender, RoutedEventArgs e)
    {
        var args = LaunchArgs.Text;
        Console.WriteLine("Set launch arguments to: " + args);
        Config.Instance.LaunchArgs = args;
        Config.Save();
    }
}