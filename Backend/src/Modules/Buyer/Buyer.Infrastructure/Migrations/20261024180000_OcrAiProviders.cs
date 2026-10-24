using Buyer.Infrastructure.DbContext;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    [DbContext(typeof(RepositoryContext))]
    [Migration("20261024180000_OcrAiProviders")]
    public partial class OcrAiProviders : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "primary_ocr_enabled",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ai_fallback_enabled",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ai_providers_json",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ai_provider_secrets",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(max)",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "primary_ocr_enabled", schema: "buyersystem", table: "sila_ocr_configuration");
            migrationBuilder.DropColumn(name: "ai_fallback_enabled", schema: "buyersystem", table: "sila_ocr_configuration");
            migrationBuilder.DropColumn(name: "ai_providers_json", schema: "buyersystem", table: "sila_ocr_configuration");
            migrationBuilder.DropColumn(name: "ai_provider_secrets", schema: "buyersystem", table: "sila_ocr_configuration");
        }
    }
}
