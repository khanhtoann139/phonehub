namespace PhoneHub.Api.Infrastructure;

/// <summary>
/// Nạp file .env (KEY=VALUE) vào biến môi trường khi chạy local. Biến đã có sẵn trong môi trường
/// thì KHÔNG bị ghi đè — trên server cấu hình bằng biến môi trường thật, không cần file .env.
/// </summary>
public static class DotEnv
{
    public static void Load(params string[] candidates)
    {
        var path = candidates.FirstOrDefault(File.Exists);
        if (path is null) return;

        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var idx = line.IndexOf('=');
            if (idx <= 0) continue;

            var key = line[..idx].Trim();
            var value = line[(idx + 1)..].Trim();
            if (value.Length >= 2 && (value[0] == '"' && value[^1] == '"' || value[0] == '\'' && value[^1] == '\''))
                value = value[1..^1];

            if (Environment.GetEnvironmentVariable(key) is null)
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}
