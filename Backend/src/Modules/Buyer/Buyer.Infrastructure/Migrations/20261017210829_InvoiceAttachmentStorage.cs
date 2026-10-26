using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceAttachmentStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "attachment_path",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "attachment_storage",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "share_point_folder",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "share_point_library",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "share_point_site_url",
                schema: "buyersystem",
                table: "sila_ocr_configuration",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "attachment_path",
                schema: "buyersystem",
                table: "sila_ocr_configuration");

            migrationBuilder.DropColumn(
                name: "attachment_storage",
                schema: "buyersystem",
                table: "sila_ocr_configuration");

            migrationBuilder.DropColumn(
                name: "share_point_folder",
                schema: "buyersystem",
                table: "sila_ocr_configuration");

            migrationBuilder.DropColumn(
                name: "share_point_library",
                schema: "buyersystem",
                table: "sila_ocr_configuration");

            migrationBuilder.DropColumn(
                name: "share_point_site_url",
                schema: "buyersystem",
                table: "sila_ocr_configuration");
        }
    }
}
