using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace RocketLauncher;

public static class AccountManager
{
    private static readonly string AppDataFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "RocketLauncher"
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
            Accounts = JsonSerializer.Deserialize<List<Account>>(json) ?? new List<Account>();
        }
    }

    public static void Save()
    {
        if (!Directory.Exists(AppDataFolder))
            Directory.CreateDirectory(AppDataFolder);

        var json = JsonSerializer.Serialize(Accounts, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SaveFile, json);
    }

    public static void Add(Account acc)
    {
        Accounts.Add(acc);
        Save();
    }

    public static void Remove(Account acc)
    {
        Accounts.Remove(acc);
        Save();
    }
}