using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Buyer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class IntegrationConfigurations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "api_integration_configuration",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    organization_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    entity_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    process_type = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    protocol = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    system_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    base_url = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    resource_path = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    authentication_type = table.Column<string>(type: "nvarchar(40)", nullable: false),
                    username = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    protected_password = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    protected_client_id = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    protected_client_secret = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    protected_bearer_token = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    token_endpoint = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    token_scope = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    token_headers_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    token_body_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    api_key_header = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    protected_api_key = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    http_method = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    payload_format = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    request_body = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    headers_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    timeout_seconds = table.Column<int>(type: "int", nullable: false),
                    retry_count = table.Column<int>(type: "int", nullable: false),
                    page_size = table.Column<int>(type: "int", nullable: true),
                    watermark_field = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    last_watermark = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_attempt_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_successful_run_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    next_run_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    is_running = table.Column<bool>(type: "bit", nullable: false),
                    running_since = table.Column<DateTime>(type: "datetime2", nullable: true),
                    last_error_safe = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    schedule_cron = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    tested_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_api_integration_configuration", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "api_field_mapping",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    configuration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    source_field = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    target_field = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    transformation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    null_policy = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    default_value = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    is_validated = table.Column<bool>(type: "bit", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_api_field_mapping", x => x.id);
                    table.ForeignKey(
                        name: "fk_api_field_mapping_api_integration_configuration_configuration_id",
                        column: x => x.configuration_id,
                        principalSchema: "buyersystem",
                        principalTable: "api_integration_configuration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "api_integration_execution",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    configuration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    trigger = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    started_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    completed_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    records_read = table.Column<int>(type: "int", nullable: false),
                    records_created = table.Column<int>(type: "int", nullable: false),
                    records_updated = table.Column<int>(type: "int", nullable: false),
                    records_failed = table.Column<int>(type: "int", nullable: false),
                    watermark_before = table.Column<DateTime>(type: "datetime2", nullable: true),
                    watermark_after = table.Column<DateTime>(type: "datetime2", nullable: true),
                    error_code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    error_message_safe = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    detail_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_api_integration_execution", x => x.id);
                    table.ForeignKey(
                        name: "fk_api_integration_execution_api_integration_configuration_configuration_id",
                        column: x => x.configuration_id,
                        principalSchema: "buyersystem",
                        principalTable: "api_integration_configuration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "integration_schema_snapshot",
                schema: "buyersystem",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    configuration_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    metadata_url = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    schema_json = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    discovered_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_created = table.Column<DateTime>(type: "datetime2", nullable: false),
                    date_updated = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_integration_schema_snapshot", x => x.id);
                    table.ForeignKey(
                        name: "fk_integration_schema_snapshot_api_integration_configuration_configuration_id",
                        column: x => x.configuration_id,
                        principalSchema: "buyersystem",
                        principalTable: "api_integration_configuration",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_api_field_mapping_configuration_id_source_field_target_field",
                schema: "buyersystem",
                table: "api_field_mapping",
                columns: new[] { "configuration_id", "source_field", "target_field" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_api_field_mapping_is_active",
                schema: "buyersystem",
                table: "api_field_mapping",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_api_integration_configuration_is_active",
                schema: "buyersystem",
                table: "api_integration_configuration",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_api_integration_configuration_organization_id_entity_code_process_type",
                schema: "buyersystem",
                table: "api_integration_configuration",
                columns: new[] { "organization_id", "entity_code", "process_type" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_api_integration_configuration_status_next_run_at",
                schema: "buyersystem",
                table: "api_integration_configuration",
                columns: new[] { "status", "next_run_at" });

            migrationBuilder.CreateIndex(
                name: "ix_api_integration_execution_configuration_id_started_at",
                schema: "buyersystem",
                table: "api_integration_execution",
                columns: new[] { "configuration_id", "started_at" });

            migrationBuilder.CreateIndex(
                name: "ix_api_integration_execution_is_active",
                schema: "buyersystem",
                table: "api_integration_execution",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_integration_schema_snapshot_configuration_id",
                schema: "buyersystem",
                table: "integration_schema_snapshot",
                column: "configuration_id");

            migrationBuilder.CreateIndex(
                name: "ix_integration_schema_snapshot_is_active",
                schema: "buyersystem",
                table: "integration_schema_snapshot",
                column: "is_active");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "api_field_mapping",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "api_integration_execution",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "integration_schema_snapshot",
                schema: "buyersystem");

            migrationBuilder.DropTable(
                name: "api_integration_configuration",
                schema: "buyersystem");
        }
    }
}
