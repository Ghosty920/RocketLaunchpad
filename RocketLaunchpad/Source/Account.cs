namespace RocketLaunchpad;

public class Account
{
    public string? Username { get; set; }
    public string? AccountId { get; set; }

    public string? AuthDeviceId { get; set; }
    public string? AuthSecret { get; set; }

    public string? AccessToken { get; set; }
    public long AccessExpiresAt { get; set; }
    public string? RefreshToken { get; set; }
    public long RefreshExpiresAt { get; set; }

    public async Task Refresh()
    {
        // TODO add an implementation using RefreshToken
        
        try
        {
            await AccountLogin.UseDeviceAuth(this);
        }
        catch (Exception exception)
        {
            throw new Exception("Fetching Access using Device Auth failed.", exception);
        }
    }
}