using System.IO;
using System.Text.Json;

namespace RocketLaunchpad;

public class Config
{
    private static readonly string SaveFile = Path.Combine(Utils.AppDataFolder, "config.json");

    public static Config Instance = new ();
    
    public string LaunchPath { get; set; } = "";
    public string LaunchArgs { get; set; } = "-language=INT";
    
    public bool CloseOnLaunch { get; set; } = false;
    public bool ShowStatsPage { get; set; } = true;
    
    public static void Load()
    {
        if (!Directory.Exists(Utils.AppDataFolder))
            Directory.CreateDirectory(Utils.AppDataFolder);

        if (File.Exists(SaveFile))
        {
            var json = File.ReadAllText(SaveFile);
            Instance = JsonSerializer.Deserialize<Config>(json) ?? new Config();
            Console.WriteLine("Loaded config");
        }
        else
        {
            Console.WriteLine("No config found (first launch)");
        }
    }

    public static void Save()
    {
        if (!Directory.Exists(Utils.AppDataFolder))
            Directory.CreateDirectory(Utils.AppDataFolder);

        var json = JsonSerializer.Serialize(Instance, Utils.JsonSerializeOptions);
        File.WriteAllText(SaveFile, json);
        Console.WriteLine("Saved config");
    }
}