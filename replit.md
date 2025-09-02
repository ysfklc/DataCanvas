# DataBoard - Dashboard Management System

## Overview

DataBoard is a full-stack dashboard management application that enables users to create, configure, and visualize data from various sources. The system provides a comprehensive platform for building interactive dashboards with support for multiple data source types including APIs, web scraping, and databases. Users can create custom visualizations, manage data sources, and control access through role-based authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and modern development
- **UI Library**: Shadcn/ui components built on Radix UI primitives for consistent design
- **Styling**: Tailwind CSS with custom CSS variables for theming and responsive design
- **State Management**: TanStack React Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for REST API endpoints
- **Language**: TypeScript for type safety across the entire stack
- **Authentication**: Session-based authentication with bcrypt for password hashing
- **API Design**: RESTful endpoints with consistent error handling and logging middleware
- **Development**: Hot module replacement and automatic server restart during development

### Database Architecture
- **ORM**: Drizzle ORM for type-safe database interactions and schema management
- **Database**: PostgreSQL with Neon serverless for scalable cloud hosting
- **Schema**: Well-defined relational schema with proper foreign key constraints
- **Migrations**: Automated schema migrations through Drizzle Kit

### Data Source Integration
- **Multiple Types**: Support for API endpoints, web scraping, and direct database connections
- **Configuration**: JSON-based configuration storage for flexible data source setup
- **Real-time**: Configurable refresh intervals for automatic data updates
- **Testing**: Built-in data source connectivity testing and validation

### Authentication & Authorization
- **Multi-method**: Support for local authentication with plans for LDAP integration
- **Role-based**: Admin and standard user roles with appropriate access controls
- **Session Management**: Secure session handling with configurable timeouts
- **Security**: Password hashing, secure cookies, and CSRF protection

### Visualization System
- **Chart Types**: Support for tables, bar charts, line charts, and other visualization types
- **Interactive Canvas**: Drag-and-drop dashboard canvas with grid snapping
- **Responsive**: Charts and components adapt to different screen sizes
- **Real-time**: Live data updates with configurable refresh intervals

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL database hosting with WebSocket support
- **Express Session**: Session management with memory store for development
- **Bcrypt**: Password hashing and authentication security

### UI & Visualization
- **Radix UI**: Comprehensive set of accessible UI primitives and components
- **Recharts**: React charting library for data visualization components
- **Lucide React**: Icon library for consistent iconography throughout the application
- **Tailwind CSS**: Utility-first CSS framework for responsive styling

### Development & Build Tools
- **Vite**: Fast build tool with hot module replacement and TypeScript support
- **TypeScript**: Type checking and enhanced development experience
- **Drizzle Kit**: Database schema management and migration tools
- **TanStack React Query**: Server state management and data fetching
- **Wouter**: Lightweight routing solution for single-page application navigation

### Optional Integrations
- **LDAP Support**: Planned integration for enterprise authentication (not yet implemented)
- **WebSocket**: Real-time updates capability (infrastructure in place)
- **External APIs**: Flexible configuration system for connecting to various data sources