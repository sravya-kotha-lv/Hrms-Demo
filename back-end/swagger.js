const swaggerJSDoc = require("swagger-jsdoc");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "HRMS API",
    version: "1.0.0",
    description: "HRMS backend APIs"
  },
  servers: [
    {
      url: "http://localhost:8000/api",
      description: "Local server"
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  security: [{ bearerAuth: [] }],

  // 🔥 ALL ROUTES DEFINED HERE
  paths: {
    "/users/register": {
      post: {
        tags: ["Users"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "organizationId"],
                properties: {
                  email: { type: "string", example: "admin@company.com" },
                  password: { type: "string", example: "Password@123" },
                  organizationId: {
                    type: "string",
                    example: "65c1f0b0b9a1eaa111111111"
                  },
                  roleIds: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "User registered successfully" },
          409: { description: "Email already registered" }
        }
      }
    },

    "/users/login": {
      post: {
        tags: ["Users"],
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "admin@company.com" },
                  password: { type: "string", example: "Password@123" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    activeRole: { type: "object" },
                    availableRoles: {
                      type: "array",
                      items: { type: "object" }
                    }
                  }
                }
              }
            }
          },
          400: { description: "Invalid credentials" }
        }
      }
    },

    "/users/send-otp": {
      post: {
        tags: ["Users"],
        summary: "Send OTP to email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", example: "admin@company.com" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "OTP sent successfully" },
          404: { description: "Email not registered" }
        }
      }
    },

    "/users/verify-otp": {
      post: {
        tags: ["Users"],
        summary: "Verify OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp"],
                properties: {
                  email: { type: "string", example: "admin@company.com" },
                  otp: { type: "string", example: "123456" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "OTP verified successfully" },
          400: { description: "Invalid or expired OTP" }
        }
      }
    },

    "/employees": {
      post: {
        tags: ["Employees"],
        summary: "Create employee",
        description: "Requires permission: EMP_CREATE",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateEmployee"
              }
            }
          }
        },
        responses: {
          201: { description: "Employee created successfully" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" }
        }
      },

      get: {
        tags: ["Employees"],
        summary: "List employees",
        description: "Requires permission: EMP_VIEW",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", example: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", example: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
          { name: "designationId", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: ["active", "on_leave", "resigned"]
            }
          }
        ],
        responses: {
          200: { description: "Employees fetched successfully" }
        }
      }
    },

    "/employees/{id}": {
      get: {
        tags: ["Employees"],
        summary: "Get employee by ID",
        description: "Requires permission: EMP_VIEW",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: { description: "Employee fetched successfully" },
          404: { description: "Employee not found" }
        }
      },

      put: {
        tags: ["Employees"],
        summary: "Update employee",
        description: "Requires permission: EMP_UPDATE",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateEmployee"
              }
            }
          }
        },
        responses: {
          200: { description: "Employee updated successfully" }
        }
      },

      delete: {
        tags: ["Employees"],
        summary: "Delete employee (soft delete)",
        description: "Requires permission: EMP_DELETE",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: { description: "Employee deleted successfully" }
        }
      }
    },

    "/employees/me": {
      get: {
        tags: ["Employees"],
        summary: "Get logged-in employee profile",
        description: "Requires permission: EMP_SELF_VIEW",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Employee profile fetched" }
        }
      }
    },

    "/employees/{id}/restore": {
      patch: {
        tags: ["Employees"],
        summary: "Restore deleted employee",
        description: "Requires permission: EMP_RESTORE",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: { description: "Employee restored successfully" }
        }
      }
    },

    "/departments": {
      post: {
        tags: ["Departments"],
        summary: "Create department",
        description: "Create a new department in the organization",
        security: [{ bearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "code"],
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    example: "Human Resources"
                  },
                  code: {
                    type: "string",
                    minLength: 2,
                    example: "HR"
                  },
                  managerId: {
                    type: "string",
                    nullable: true,
                    example: "64f1c9e8f9b1a23c8a9d1234"
                  }
                }
              }
            }
          }
        },

        responses: {
          201: {
            description: "Department created successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          409: {
            description: "Department with same code already exists"
          }
        }
      },
      get: {
        tags: ["Departments"],
        summary: "List departments",
        description: "Fetch all active departments for the organization",
        security: [{ bearerAuth: [] }],

        responses: {
          200: {
            description: "Departments fetched successfully",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      _id: {
                        type: "string",
                        example: "64f1c9e8f9b1a23c8a9d1234"
                      },
                      name: {
                        type: "string",
                        example: "Human Resources"
                      },
                      code: {
                        type: "string",
                        example: "HR"
                      },
                      managerId: {
                        type: "string",
                        nullable: true,
                        example: "64f1c9e8f9b1a23c8a9d5678"
                      },
                      status: {
                        type: "string",
                        enum: ["active", "inactive"],
                        example: "active"
                      },
                      createdAt: {
                        type: "string",
                        format: "date-time"
                      },
                      updatedAt: {
                        type: "string",
                        format: "date-time"
                      }
                    }
                  }
                }
              }
            }
          },

          401: {
            description: "Unauthorized"
          },
          403: {
            description: "Permission denied"
          }
        }
      }
    },

    "/departments/{id}": {
      put: {
        tags: ["Departments"],
        summary: "Update department",
        description: "Update an existing department",
        security: [{ bearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }
        ],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    minLength: 2,
                    example: "Updated HR"
                  },
                  code: {
                    type: "string",
                    minLength: 2,
                    example: "HR_NEW"
                  },
                  managerId: {
                    type: "string",
                    nullable: true,
                    example: "64f1c9e8f9b1a23c8a9d1234"
                  },
                  status: {
                    type: "string",
                    enum: ["active", "inactive"],
                    example: "active"
                  }
                }
              }
            }
          }
        },

        responses: {
          200: {
            description: "Department updated successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          404: {
            description: "Department not found"
          }
        }
      },
      delete: {
        tags: ["Departments"],
        summary: "Delete department",
        description: "Soft delete a department",
        security: [{ bearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            },
            description: "Department ID"
          }
        ],

        responses: {
          200: {
            description: "Department deleted successfully"
          },
          401: {
            description: "Unauthorized"
          },
          403: {
            description: "Permission denied"
          },
          404: {
            description: "Department not found"
          }
        }
      }
    },

    "/roles": {
      get: {
        tags: ["Roles"],
        summary: "List roles",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Roles fetched" } }
      },

      post: {
        tags: ["Roles"],
        summary: "Create role",
        description: "Create a new role with permissions",
        security: [{ bearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "slug", "permissionIds"],
                properties: {
                  name: {
                    type: "string",
                    example: "HR Manager"
                  },
                  slug: {
                    type: "string",
                    example: "hr_manager"
                  },
                  permissionIds: {
                    type: "array",
                    items: {
                      type: "string",
                      example: "64f1c9e8f9b1a23c8a9d1234"
                    }
                  },
                  isSystemRole: {
                    type: "boolean",
                    example: false
                  }
                }
              }
            }
          }
        },

        responses: {
          201: {
            description: "Role created successfully"
          },
          400: {
            description: "Validation error"
          },
          403: {
            description: "Permission denied"
          },
          409: {
            description: "Role already exists"
          }
        }
      }

    },

    "/roles/{id}": {
      put: {
        tags: ["Roles"],
        summary: "Update role",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", example: "Updated Role" },
                  permissionIds: {
                    type: "array",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Role updated successfully" },
          404: { description: "Role not found" }
        }
      },

      delete: {
        tags: ["Roles"],
        summary: "Delete role",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { 200: { description: "Role deleted" } }
      }
    },

    "/roles/switch": {
      post: {
        tags: ["Roles"],
        summary: "Switch active role",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["roleId"],
                properties: {
                  roleId: { type: "string" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Role switched" } }
      }
    },

    "/organizations": {
      post: {
        tags: ["Organizations"],
        summary: "Create organization",
        security: [{ bearerAuth: [] }],

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "code", "timezone", "currency"],
                properties: {
                  name: {
                    type: "string",
                    example: "Luvetha Tech Solutions"
                  },
                  code: {
                    type: "string",
                    example: "LV"
                  },
                  timezone: {
                    type: "string",
                    example: "Asia/Kolkata"
                  },
                  currency: {
                    type: "string",
                    example: "INR"
                  }
                }
              }
            }
          }
        },

        responses: {
          201: {
            description: "Organization created successfully"
          },
          401: {
            description: "Unauthorized"
          },
          409: {
            description: "Organization already exists"
          }
        }
      },
      get: {
        tags: ["Organizations"],
        summary: "List organizations",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Organizations fetched" } }
      }
    },

    "/organizations/{id}": {
      get: {
        tags: ["Organizations"],
        summary: "Get organization by ID",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: { description: "Organization fetched" },
          404: { description: "Organization not found" }
        }
      },

      put: {
        tags: ["Organizations"],
        summary: "Update organization",
        security: [{ bearerAuth: [] }],

        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],

        // 🔥 THIS IS WHAT YOU MISSED
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    example: "Luvetha Tech Solutions"
                  },
                  timezone: {
                    type: "string",
                    example: "Asia/Kolkata"
                  },
                  currency: {
                    type: "string",
                    example: "INR"
                  },
                  status: {
                    type: "string",
                    enum: ["active", "inactive"]
                  }
                }
              }
            }
          }
        },

        responses: {
          200: { description: "Organization updated successfully" },
          400: { description: "Validation error" },
          401: { description: "Unauthorized" },
          404: { description: "Organization not found" }
        }
      }
    }

  },

  tags: [
    { name: "Users", description: "User authentication & OTP APIs" }
  ]
};

module.exports = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: [] // 👈 empty because we are NOT scanning route files
});
