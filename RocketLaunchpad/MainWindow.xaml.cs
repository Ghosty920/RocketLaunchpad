using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using RocketLaunchpad.Components;

namespace RocketLaunchpad;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        AccountManager.Load();
        RefreshAccounts();
    }

    private void RefreshAccounts()
    {
        for (var i = AccountListControl.Items.Count - 2; i >= 0; i--)
        {
            AccountListControl.Items.RemoveAt(i);
        }

        GridContent.Children.OfType<WelcomePage>().FirstOrDefault()?.Refresh();

        foreach (var acc in AccountManager.Accounts)
        {
            var border = new Border
            {
                Style = (Style)FindResource("AccountBorderStyle")
            };
            var userText = new TextBlock
            {
                Text = acc.Username,
                Style = (Style)FindResource("AccountTextStyle")
            };
            border.Child = userText;

            border.MouseLeftButtonDown += async (s, e) =>
            {
                MessageBox.Show($"Launching game with {acc.Username}");
                try
                {
                    await Launcher.LaunchGame(acc);
                }
                catch (Exception exception)
                {
                    MessageBox.Show(exception.Message, "Launch Failed", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            };

            var index = AccountListControl.Items.IndexOf(AddAccountButton);
            AccountListControl.Items.Insert(index, border);
        }
    }

    private async void AddAccount_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            LoadingPopup.Visibility = Visibility.Visible;
            var account = await AccountProcess.Login(LoadingText);
            if (account is null
                or { AccountId: null }
                or { AuthDeviceId: null }
                or { AuthSecret: null }
                or { AccessToken: null }) // this last line is just to make sure the DeviceId & Secret are valid
                throw new Exception("Could not register account");
            AccountManager.Add(account);
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message, "Login Failed", MessageBoxButton.OK, MessageBoxImage.Error);
            Console.WriteLine(exception);
        }
        finally
        {
            LoadingPopup.Visibility = Visibility.Collapsed;
            RefreshAccounts();
        }
    }

    private void UI_OpenDiscord(object sender, MouseButtonEventArgs e)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = "https://ghosty.im/discord?from=rocketlaunchpad",
            UseShellExecute = true
        });
    }

    private void UI_OpenGithub(object sender, MouseButtonEventArgs e)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = "https://github.com/Ghosty920/RocketLaunchpad",
            UseShellExecute = true
        });
    }

    private void UI_OpenSettings(object sender, MouseButtonEventArgs e)
    {
        if (GridContent.Children[0] is SettingsPage) {
            GridContent.Children.Clear();
            GridContent.Children.Add(new WelcomePage());
        }
        else
        {
            GridContent.Children.Clear();
            GridContent.Children.Add(new SettingsPage());
        }
    }
}