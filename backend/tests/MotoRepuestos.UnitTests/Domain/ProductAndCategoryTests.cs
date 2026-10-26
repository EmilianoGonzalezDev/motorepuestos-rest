using MotoRepuestos.Domain.Catalog;
using MotoRepuestos.Domain.Common;

namespace MotoRepuestos.UnitTests.Domain;

public class ProductAndCategoryTests
{
    [Fact]
    public void Product_builds_accent_insensitive_search_text_without_html()
    {
        var product = Product.Create(1, "Batería Gel 12N7", "<p>Para <strong>motos</strong> Honda &amp; Yamaha</p>", 100m, 1);

        product.SearchText.ShouldContain("bateria gel 12n7");
        product.SearchText.ShouldContain("motos");
        product.SearchText.ShouldContain("honda & yamaha");
        product.SearchText.ShouldNotContain("<");
    }

    [Theory]
    [InlineData("", "desc", 10, 1)]
    [InlineData("name", "", 10, 1)]
    [InlineData("name", "desc", -1, 1)]
    [InlineData("name", "desc", 10, -1)]
    public void Product_validates_its_invariants(string name, string description, decimal price, int stock)
    {
        Should.Throw<DomainException>(() => Product.Create(1, name, description, price, stock));
    }

    [Fact]
    public void Product_requires_a_category()
    {
        Should.Throw<DomainException>(() => Product.Create(0, "n", "d", 1, 1)).Code.ShouldBe("product.category_required");
    }

    [Fact]
    public void Restocking_never_exceeds_the_maximum_stock()
    {
        var product = Product.Create(1, "n", "d", 1, Product.MaxStock - 1);

        product.IncreaseStock(10);

        product.Stock.ShouldBe(Product.MaxStock);
    }

    [Fact]
    public void Category_cannot_be_deactivated_while_it_has_active_products()
    {
        var category = Category.Create("Frenos");

        Should.Throw<DomainException>(() => category.Deactivate(hasActiveProducts: true))
            .Code.ShouldBe("category.has_active_products");
        category.IsActive.ShouldBeTrue();

        category.Deactivate(hasActiveProducts: false);
        category.IsActive.ShouldBeFalse();
    }

    [Fact]
    public void Category_name_is_trimmed_and_limited()
    {
        Category.Create("  Frenos  ").Name.ShouldBe("Frenos");
        Should.Throw<DomainException>(() => Category.Create(new string('x', Category.NameMaxLength + 1)));
    }
}

public class SearchTextTests
{
    [Theory]
    [InlineData("Batería", "bateria")]
    [InlineData("  CASCO  Integral ", "casco integral")]
    [InlineData("Suspensión Trasera", "suspension trasera")]
    [InlineData(null, "")]
    public void Normalize_lowercases_trims_and_strips_accents(string? input, string expected)
    {
        SearchText.Normalize(input).ShouldBe(expected);
    }

    [Fact]
    public void SplitTerms_returns_every_word_normalized()
    {
        SearchText.SplitTerms("Bujía  Honda").ShouldBe(["bujia", "honda"]);
    }

    [Fact]
    public void StripHtml_removes_tags_and_decodes_entities()
    {
        SearchText.StripHtml("<p>Aceite&nbsp;<b>5W40</b></p>").ShouldContain("5W40");
        SearchText.StripHtml("<p>Aceite <b>5W40</b></p>").ShouldNotContain("<");
    }
}
