using FluentValidation;
using MotoRepuestos.Application.Common;
using MotoRepuestos.Application.Features.Auth;
using MotoRepuestos.Application.Features.Categories;
using MotoRepuestos.Application.Features.Orders;
using MotoRepuestos.Application.Features.Products;
using MotoRepuestos.Domain.Ordering;

namespace MotoRepuestos.UnitTests.Application;

public class PagingTests
{
    [Theory]
    [InlineData(null, null, 1, 10)]
    [InlineData(0, 0, 1, 10)]
    [InlineData(-3, -1, 1, 10)]
    [InlineData(3, 25, 3, 25)]
    [InlineData(2, 5000, 2, Paging.MaxPageSize)]
    public void Normalize_applies_defaults_and_caps_the_page_size(int? page, int? size, int expectedPage, int expectedSize)
    {
        Paging.Normalize(page, size).ShouldBe((expectedPage, expectedSize));
    }

    [Fact]
    public void PagedResponse_computes_navigation_flags()
    {
        var response = new PagedResponse<int>([1, 2], Page: 2, PageSize: 2, TotalItems: 5);

        response.TotalPages.ShouldBe(3);
        response.HasPrevious.ShouldBeTrue();
        response.HasNext.ShouldBeTrue();
    }
}

public class ResultTests
{
    [Fact]
    public void Success_exposes_its_value()
    {
        Result<int> result = 42;

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(42);
    }

    [Fact]
    public void Failure_carries_the_error_and_refuses_to_expose_a_value()
    {
        Result<int> result = Error.NotFound("x.not_found", "No existe");

        result.IsFailure.ShouldBeTrue();
        result.Error!.Type.ShouldBe(ErrorType.NotFound);
        Should.Throw<InvalidOperationException>(() => result.Value);
    }
}

public class ValidatorTests
{
    [Theory]
    [InlineData("Abcdef12", true)]
    [InlineData("abcdefgh", false)] // no digit
    [InlineData("12345678", false)] // no letter
    [InlineData("Ab1", false)] // too short
    public void Passwords_need_letters_digits_and_length(string password, bool valid)
    {
        new RegisterRequestValidator().Validate(new RegisterRequest("Juan Pérez", "juan@example.com", password)).IsValid.ShouldBe(valid);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("")]
    public void Registration_rejects_invalid_emails(string email)
    {
        new RegisterRequestValidator().Validate(new RegisterRequest("Juan", email, "Abcdef12")).IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Product_validator_reports_every_invalid_field()
    {
        var result = new UpsertProductRequestValidator().Validate(new UpsertProductRequest(0, "", "", -1, -5));

        result.Errors.Select(e => e.PropertyName).ShouldBe(
            ["CategoryId", "Name", "Description", "Price", "Stock"], ignoreOrder: true);
    }

    [Fact]
    public void ToError_groups_messages_by_camelCase_field()
    {
        var error = new UpsertCategoryRequestValidator().Validate(new UpsertCategoryRequest("")).ToError();

        error.Type.ShouldBe(ErrorType.Validation);
        error.ValidationErrors!.ShouldContainKey("name");
    }

    [Fact]
    public void Place_order_validator_rejects_unknown_payment_types()
    {
        new PlaceOrderRequestValidator().Validate(new PlaceOrderRequest((PaymentType)99, null)).IsValid.ShouldBeFalse();
        new PlaceOrderRequestValidator().Validate(new PlaceOrderRequest(PaymentType.Card, null)).IsValid.ShouldBeTrue();
    }
}

public class ProductImagesTests
{
    [Fact]
    public void Recognizes_real_image_signatures()
    {
        ProductImages.HasValidSignature([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0]).ShouldBeTrue(); // JPEG
        ProductImages.HasValidSignature([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).ShouldBeTrue(); // PNG
        ProductImages.HasValidSignature("GIF89a"u8.ToArray()).ShouldBeTrue();
        ProductImages.HasValidSignature("RIFF\0\0\0\0WEBP"u8.ToArray()).ShouldBeTrue();
    }

    [Fact]
    public void Rejects_files_that_only_pretend_to_be_images()
    {
        ProductImages.HasValidSignature("MZ\x90\0\x03\0\0\0"u8.ToArray()).ShouldBeFalse(); // Windows executable
        ProductImages.HasValidSignature("<script>alert(1)</script>"u8.ToArray()).ShouldBeFalse();
        ProductImages.HasValidSignature([]).ShouldBeFalse();
    }

    [Fact]
    public void Url_is_built_from_the_public_path()
    {
        ProductImages.Url("abc.webp").ShouldBe("/images/products/abc.webp");
        ProductImages.Url(null).ShouldBeNull();
    }
}
