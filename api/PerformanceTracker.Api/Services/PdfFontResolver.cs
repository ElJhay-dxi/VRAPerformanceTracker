using System.Reflection;
using PdfSharp.Fonts;

namespace PerformanceTracker.Api.Services;

/// <summary>
/// PDFsharp 6 has no OS font access by default (needed for Linux hosts like Azure App
/// Service), so every family name — including MigraDoc's own internal fallback fonts —
/// has to resolve through here. Everything maps to one bundled, Apache-2.0-licensed
/// typeface (Open Sans) rather than trying to match the requested family; only
/// bold/regular actually varies.
/// </summary>
public sealed class PdfFontResolver : IFontResolver
{
    public const string FamilyName = "Open Sans";

    private const string RegularFace = "OpenSans#Regular";
    private const string BoldFace = "OpenSans#Bold";

    private static readonly Lazy<byte[]> Regular = new(() => ReadFont("OpenSans-Regular.ttf"));
    private static readonly Lazy<byte[]> Bold = new(() => ReadFont("OpenSans-Bold.ttf"));

    public string DefaultFontName => FamilyName;

    public FontResolverInfo ResolveTypeface(string familyName, bool isBold, bool isItalic) =>
        new(isBold ? BoldFace : RegularFace);

    public byte[] GetFont(string faceName) => faceName == BoldFace ? Bold.Value : Regular.Value;

    private static byte[] ReadFont(string fileName)
    {
        var asm = Assembly.GetExecutingAssembly();
        var resourceName = $"{asm.GetName().Name}.Assets.Fonts.{fileName}";
        using var stream = asm.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded font resource '{resourceName}' not found.");
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }
}
