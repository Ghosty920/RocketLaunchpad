using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Net.Http;
using System.Threading.Tasks;

namespace RocketLauncher;

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
        AccountsList.Children.Clear();

        foreach (var acc in AccountManager.Accounts)
        {
            var shadow = new DropShadowEffect
            {
                Color = Colors.White,
                BlurRadius = 20,
                ShadowDepth = 0,
                Opacity = 0.7,
                RenderingBias = RenderingBias.Quality
            };

            var border = new Border
            {
                Style = (Style)FindResource("UserBorderStyle"),
                Margin = new Thickness(0, 0, 0, 20),
                Effect = shadow
            };

            var userText = new TextBlock
            {
                Text = acc.Username,
                Style = (Style)FindResource("UserTextStyle")
            };
            border.MouseLeftButtonDown += (s, e) =>
            {
                //MessageBox.Show($"Clicked {acc}");
                Launcher.LaunchGame(acc);
            };
            border.Child = userText;

            AccountsList.Children.Add(border);
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
}