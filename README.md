# UROps - Building Maintenance Software

UROps is a web-based quotation and invoice management system designed for maintenance companies. It features client management, automated quoting with AI assistance, and financial tracking.

## Features

-   **Client Management**: Track clients, their contact details, and project history.
-   **Quoting & Invoicing**: Generate professional quotes and invoices.
-   **AI Pricing Knowledge**: The system learns from your past quotes to suggest prices for future work.
-   **Financial Dashboard**: Track revenue, outstanding invoices, and payments.
-   **Role-Based Access**: Simulate Admin and Manager roles.

## Prerequisites

-   **Node.js**: Version 18.17 or later.
-   **Database**: A PostgreSQL database (Superbase recommended).

## Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Configure Environment**
    Duplicate `.env.example` to `.env` and fill in your database credentials:
    ```bash
    cp .env.example .env
    ```
    *Open `.env` and update `DATABASE_URL` and `DIRECT_URL` with your actual connection strings.*

3.  **Initialize Database**
    Push the schema to your database:
    ```bash
    npx prisma db push
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Connection string for the PostgreSQL database (Transaction pooler). |
| `DIRECT_URL` | Direct connection string for the PostgreSQL database (Session mode). |
| `OPENAI_API_KEY` | (Optional) API key for AI features. If omitted, the app runs in Mock Mode. |

## Deployment

This application is optimized for deployment on **Vercel**.

1.  Push your code to a Git repository (GitHub/GitLab).
2.  Import the project in Vercel.
3.  Add the environment variables (`DATABASE_URL`, `DIRECT_URL`, `OPENAI_API_KEY`) in the Vercel project settings.
4.  Deploy.

## Troubleshooting

-   **Database Errors**: Ensure your IP is allowed in Supabase (or your DB provider) settings if running locally.
-   **Build Errors**: If the build fails on static generation, ensure `force-dynamic` is set on pages requiring database access.
