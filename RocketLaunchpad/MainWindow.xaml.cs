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

            border.MouseLeftButtonDown += (s, e) => { LaunchAccount(acc); };

            var index = AccountListControl.Items.IndexOf(AddAccountButton);
            AccountListControl.Items.Insert(index, border);
        }
    }

    private async void LaunchAccount(Account account)
    {
        var keepPopup = false;
        try
        {
            RestorePopup(true);
            PopupText.Text = $"Launching {account.Username} ...";
            await Launcher.LaunchGame(account);
        }
        catch (LoginUtils.LoginRequestException exception)
        {
            Console.WriteLine(exception);
            Console.WriteLine($"${exception.Code}: ${exception.Response?.ToString()}");

            var continuationUrl = exception.Response?.GetProperty("continuationUrl");
            if (continuationUrl is not null)
            {
                Console.WriteLine($"Continuing login at {continuationUrl}");
                PopupText.Text = "Check your browser.";
                keepPopup = true;
                Process.Start(new ProcessStartInfo
                {
                    FileName = continuationUrl.ToString(),
                    UseShellExecute = true
                });
                ShowPopupButton(() => LaunchAccount(account));
            }
        }
        catch (Exception exception)
        {
            Console.WriteLine(exception);
            MessageBox.Show(exception.Message, "Launch Failed", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            if (!keepPopup) RestorePopup(false);
        }
    }

    private async void AddAccount_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            RestorePopup(true);
            PopupText.Text = "Starting login process ...";
            var account = await AccountProcess.Login(PopupText);
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
            Console.WriteLine(exception);
            MessageBox.Show(exception.Message, "Login Failed", MessageBoxButton.OK, MessageBoxImage.Error);
        }
        finally
        {
            RestorePopup(false);
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
        if (GridContent.Children[0] is SettingsPage)
        {
            GridContent.Children.Clear();
            GridContent.Children.Add(new WelcomePage());
        }
        else
        {
            GridContent.Children.Clear();
            GridContent.Children.Add(new SettingsPage());
        }
    }

    private Action? _doneAction;

    private void ShowPopupButton(Action action)
    {
        _doneAction = action;
        PopupProgressBar.Visibility = Visibility.Collapsed;
        PopupButton.Visibility = Visibility.Visible;
    }
    
    private void PopupButton_Click(object sender, RoutedEventArgs e)
    {
        _doneAction?.Invoke();
        PopupButton.Visibility = Visibility.Collapsed;
        PopupProgressBar.Visibility = Visibility.Visible;
    }

    private void RestorePopup(bool show)
    {
        _doneAction = null;
        PopupContainer.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        PopupProgressBar.Visibility = Visibility.Visible;
        PopupButton.Visibility = Visibility.Hidden;
    }
}