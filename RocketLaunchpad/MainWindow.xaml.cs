using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

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

        WelcomeTextIndication.Text = AccountManager.Accounts.Count == 0
            ? "To begin, add an account on the left."
            : "To begin, select an account on the left.";

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

            border.MouseLeftButtonDown += (s, e) =>
            {
                MessageBox.Show($"Launching game with {acc.Username}");
                Launcher.LaunchGame(acc);
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
            var account = await AccountLogin.RegisterAccount(LoadingText);
            if(account == null) throw new Exception("Could not register account");
            AccountManager.Add(account);
        }
        catch (Exception exception)
        {
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
        MessageBox.Show("Not implemented yet");
    }
}