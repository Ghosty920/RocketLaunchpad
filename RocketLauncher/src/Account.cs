namespace RocketLauncher;

public class Account
{
    
    public string Username { get; set; }
    public string AccountId { get; set; }
    
    public string AuthDeviceId { get; set; }
    public string AuthSecret { get; set; }
    
    public string EpicAccessToken { get; set; }
    public long EpicAccessExpiresAt { get; set; }
    public string EpicRefreshToken { get; set; }
    public long EpicRefreshExpiresAt { get; set; }
    
    public string AccAccessToken { get; set; }
    public long AccAccessExpiresAt { get; set; }
    public string AccRefreshToken { get; set; }
    public long AccRefreshExpiresAt { get; set; }
    
}