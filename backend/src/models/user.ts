import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare email: string;
  declare passwordHash: string;
  declare name: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

User.init(
  {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
      },
      email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
          validate: { isEmail: true },
      },
      passwordHash: {
          type: DataTypes.STRING,
          allowNull: false,
      },
      name: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: null,
      },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false }
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    indexes: [{ unique: true, fields: ['email'] }],
  }
);
