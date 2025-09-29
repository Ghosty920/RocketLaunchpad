using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace RocketLaunchpad;

public static class AccountManager
{
    private static readonly string AppDataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "RocketLaunchpad"
    );

    private static readonly string SaveFile = Path.Combine(AppDataFolder, "accounts.json");

    public static List<Account> Accounts { get; private set; } = new();
    public static int SelectedIndex { get; set; } = -1;

    public static void Load()
    {
        if (!Directory.Exists(AppDataFolder))
            Directory.CreateDirectory(AppDataFolder);

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
        if (!Directory.Exists(AppDataFolder))
            Directory.CreateDirectory(AppDataFolder);

        var json = JsonSerializer.Serialize(Accounts, new JsonSerializerOptions { WriteIndented = true });
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