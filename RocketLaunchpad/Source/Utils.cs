namespace RocketLaunchpad;

public class Utils
{
    public const string
        AuthClientId = "3f69e56c7649492c8cc29f1af08a8a12",
        AuthSecret = "b51ee9cb12234f50a69efa67ef53812e",
        AuthHeader = "MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=";

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