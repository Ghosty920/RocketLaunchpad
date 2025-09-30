using System.IO;
using System.Net.Http;
using System.Text.Json;

namespace RocketLaunchpad;

public static class Utils
{
    public const string
        AuthClientId = "3f69e56c7649492c8cc29f1af08a8a12",
        AuthSecret = "b51ee9cb12234f50a69efa67ef53812e",
        AuthToken = "M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU=",
        AuthEglToken = "MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=";
    
    public static HttpClient Client { get; } = new ();
    
    public static readonly string AppDataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "RocketLaunchpad"
    );
    
    public static readonly JsonSerializerOptions JsonSerializeOptions = new() { WriteIndented = true };

    static Utils()
    {
        Client.DefaultRequestHeaders.Add("User-Agent", "RocketLaunchpad/1.0"); // the version shall not change
        Client.DefaultRequestHeaders.Add("Accept", "application/json");
    }
    
    public static long ParseDate(string date)
    {
        var parsed = DateTime.Parse(date, null, System.Globalization.DateTimeStyles.AdjustToUniversal);
        return new DateTimeOffset(parsed).ToUnixTimeMilliseconds();
    }

    public static bool Expired(long time)
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() >= time - 5000;
    }

    public static string FixBase64(string str)
    {
        var fix = str.Replace('-', '+').Replace('_', '/');
        switch (fix.Length % 4)
        {
            case 2: fix += "=="; break;
            case 3: fix += "="; break;
        }

        return fix;
    }
}