using System.Windows.Controls;

namespace RocketLaunchpad.Components;

public partial class WelcomePage : UserControl
{
    public WelcomePage()
    {
        InitializeComponent();
        Refresh();
    }

    public void Refresh()
    {
        WelcomeTextIndication.Text = AccountManager.Accounts.Count == 0
            ? "To begin, add an account on the left."
            : "To begin, select an account on the left.";
    }
}