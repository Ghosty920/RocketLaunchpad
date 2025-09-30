using System.IO;
using System.Text.Json;

namespace RocketLaunchpad;

public static class AccountManager
{
    private static readonly string SaveFile = Path.Combine(Utils.AppDataFolder, "accounts.json");

    public static List<Account> Accounts { get; private set; } = new();
    public static int SelectedIndex { get; set; } = -1;

    public static void Load()
    {
        if (!Directory.Exists(Utils.AppDataFolder))
            Directory.CreateDirectory(Utils.AppDataFolder);

        if (File.Exists(SaveFile))
        {
            var json = File.ReadAllText(SaveFile);
            Accounts = JsonSerializer.Deserialize<List<Account>>(json) ?? [];
            Console.WriteLine($"Loaded {Accounts.Count} accounts");
        }
        else
        {
            Console.WriteLine("No accounts found");
        }
    }

    public static void Save()
    {
        if (!Directory.Exists(Utils.AppDataFolder))
            Directory.CreateDirectory(Utils.AppDataFolder);

        var json = JsonSerializer.Serialize(Accounts, Utils.JsonSerializeOptions);
        File.WriteAllText(SaveFile, json);
        Console.WriteLine($"Saved {Accounts.Count} accounts");
    }

    public static void Add(Account acc)
    {
        var original = Accounts.Find(a => a.AccountId == acc.AccountId);
        if (original != null)
        {
            var index = Accounts.IndexOf(original);
            Accounts.Remove(original);
            Accounts.Insert(index, acc);
            Console.WriteLine($"Updated account {acc.Username} ({acc.AccountId})");
        }
        else
        {
            Accounts.Add(acc);
            Console.WriteLine($"Added account {acc.Username} ({acc.AccountId})");
        }

        Save();
    }

    public static void Remove(Account acc)
    {
        Accounts.Remove(acc);
        Console.WriteLine($"Removed account {acc.Username} ({acc.AccountId})");
        Save();
    }
}