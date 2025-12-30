import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class CertificateEntity extends Model<InferAttributes<CertificateEntity>, InferCreationAttributes<CertificateEntity>> {
  declare id: CreationOptional<number>;
  declare certificateId: string;
  declare certificateNumber: string;
  declare issuedAt: Date;
  declare signature: string;

  // Device info
  declare driveId: string;
  declare serialNumber: CreationOptional<string | null>;
  declare model: CreationOptional<string | null>;
  declare capacityBytes: CreationOptional<number | null>;
  declare firmwareVersion: CreationOptional<string | null>;
  declare location: CreationOptional<string | null>;

  // Erasure metadata
  declare erasureMethod: string;
  declare startedAt: Date;
  declare completedAt: Date;

  // Operator
  declare operatorId: CreationOptional<string | null>;
  declare operatorName: string;
  declare operatorOrganization: CreationOptional<string | null>;

  // Verification
  declare verificationHash: CreationOptional<string | null>;
  declare verificationTool: CreationOptional<string | null>;
  declare verificationNotes: CreationOptional<string | null>;

  // Notes
  declare notes: CreationOptional<string | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

CertificateEntity.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    certificateId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    certificateNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    signature: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Device info
    driveId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serialNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    capacityBytes: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: null,
    },
    firmwareVersion: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    // Erasure metadata
    erasureMethod: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    // Operator
    operatorId: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    operatorName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    operatorOrganization: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    // Verification
    verificationHash: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    verificationTool: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    verificationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // Notes
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  },
  {
    sequelize,
    tableName: 'certificates',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['certificateId'] },
      { unique: true, fields: ['certificateNumber'] },
      { fields: ['driveId'] },
      { fields: ['operatorName'] },
    ],
  }
);
