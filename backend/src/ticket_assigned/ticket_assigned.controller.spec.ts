import { Test, TestingModule } from '@nestjs/testing';
import { TicketAssignedController } from './ticket_assigned.controller';
import { TicketAssignedService } from './ticket_assigned.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../permission/permission.service';

const mockTicketAssignedService = {
  getRole9Users: jest.fn(),
  assignTicketByTicketNo: jest.fn(),
};

const mockPermissionService = {
  canAssignTicket: jest.fn(),
};

const mockUserAllowRoleRepository = {
  // Mock repository methods if needed
};

describe('TicketAssignedController', () => {
  let controller: TicketAssignedController;
  let service: TicketAssignedService;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear mocks before each test
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketAssignedController],
      providers: [
        {
          provide: TicketAssignedService,
          useValue: mockTicketAssignedService,
        },
        {
          provide: getRepositoryToken(UserAllowRole),
          useValue: mockUserAllowRoleRepository,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<TicketAssignedController>(TicketAssignedController);
    service = module.get<TicketAssignedService>(TicketAssignedService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRole9Users', () => {
    it('should call getRole9Users from service', async () => {
      const mockResult = {
        message: 'success',
        users: [{ id: 1, name: 'user1', username: 'user1', email: 'user1@example.com' }],
        total: 1,
      };
      mockTicketAssignedService.getRole9Users.mockResolvedValue(mockResult);

      const result = await controller.getRole9Users();
      expect(result).toEqual(mockResult);
      expect(mockTicketAssignedService.getRole9Users).toHaveBeenCalled();
    });
  });

  describe('assignTicket', () => {
    it('should call assignTicketByTicketNo from service with correct parameters', async () => {
      const ticketNo = 'T-001';
      const assignedTo = 2;

      // Mock request object ตาม controller ใช้ req.user.id
      const mockReq = { user: { id: 1 } };

      const mockResult = {
        message: 'มอบหมายงานสำเร็จ',
        ticket_no: ticketNo,
        assigned_to: assignedTo,
        assignee_name: 'Assigned User',
        available_users: ['Assigned User'],
      };

      mockTicketAssignedService.assignTicketByTicketNo.mockResolvedValue(mockResult);

      const result = await controller.assignTicket(ticketNo, assignedTo, mockReq as any);

      expect(result).toEqual(mockResult);
      expect(mockTicketAssignedService.assignTicketByTicketNo)
        .toHaveBeenCalledWith(ticketNo, assignedTo, mockReq.user.id);
    });
  });
});