// backend/api/routes/automations.js
/**
 * Automations API Endpoints
 * 
 * Handles both instant automations detected from user messages
 * and configured automations from the Library tab.
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Import services
const AutomationDetectionService = require('../../services/automation/AutomationDetectionService');
const AutomationExecutionService = require('../../services/automation/AutomationExecutionService');
const OAuthService = require('../../services/oauth/OAuthService');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * @route POST /api/v1/automations/detect
 * @description Detect automation intent in a message
 * @access Private
 */
router.post('/detect', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Valid message is required' });
    }
    
    // Detect automation intent
    const automation = await AutomationDetectionService.detectAutomation(message, userId);
    
    res.json({
      automation: automation,
      hasAutomation: !!automation
    });
  } catch (error) {
    console.error('Error detecting automation:', error);
    res.status(500).json({ error: 'Failed to detect automation', message: error.message });
  }
});

/**
 * @route POST /api/v1/automations/execute
 * @description Execute an instant automation
 * @access Private
 */
router.post('/execute', async (req, res) => {
  try {
    const automation = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!automation || !automation.type || !automation.service) {
      return res.status(400).json({ error: 'Valid automation details required' });
    }
    
    // Check if required services are connected
    if (automation.requiredServices && automation.requiredServices.length > 0) {
      for (const serviceId of automation.requiredServices) {
        const isConnected = await OAuthService.isServiceConnected(userId, serviceId);
        
        if (!isConnected) {
          return res.status(400).json({
            error: 'Required service not connected',
            service: serviceId,
            needsConnection: true
          });
        }
      }
    }
    
    // Execute the automation
    const result = await AutomationExecutionService.executeAutomation(automation, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error executing automation:', error);
    res.status(500).json({ error: 'Failed to execute automation', message: error.message });
  }
});

/**
 * @route GET /api/v1/automations
 * @description Get all configured automations for the user
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get query parameters
    const { category, enabled } = req.query;
    
    // Build query
    let query = supabase
      .from('automations')
      .select('*')
      .eq('user_id', userId);
    
    // Apply filters if provided
    if (category) {
      query = query.eq('category', category);
    }
    
    if (enabled !== undefined) {
      query = query.eq('enabled', enabled === 'true');
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({ error: 'Failed to fetch automations', message: error.message });
  }
});

/**
 * @route GET /api/v1/automations/:id
 * @description Get a specific automation
 * @access Private
 */
router.get('/:id', async (req, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user.id;
    
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', automationId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching automation:', error);
    res.status(500).json({ error: 'Failed to fetch automation', message: error.message });
  }
});

/**
 * @route POST /api/v1/automations
 * @description Create a new configured automation
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, category, workflow } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!name || !workflow) {
      return res.status(400).json({ error: 'Name and workflow are required' });
    }
    
    // Validate workflow structure
    if (!workflow.trigger || !workflow.action) {
      return res.status(400).json({ error: 'Workflow must contain trigger and action' });
    }
    
    // Check if required services are connected
    if (workflow.action.service) {
      const isConnected = await OAuthService.isServiceConnected(userId, workflow.action.service);
      
      if (!isConnected) {
        return res.status(400).json({
          error: 'Required service not connected',
          service: workflow.action.service,
          needsConnection: true
        });
      }
    }
    
    // Create the automation
    const { data, error } = await supabase
      .from('automations')
      .insert({
        id: uuidv4(),
        user_id: userId,
        name,
        description: description || '',
        category: category || 'other',
        workflow,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        enabled: true,
        execution_count: 0,
        is_template: false
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ error: 'Failed to create automation', message: error.message });
  }
});

/**
 * @route PATCH /api/v1/automations/:id
 * @description Update a configured automation
 * @access Private
 */
router.patch('/:id', async (req, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user.id;
    const updates = req.body;
    
    // Check if automation exists and belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('automations')
      .select('id')
      .eq('id', automationId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    
    // Prevent updating certain fields
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    delete updates.execution_count;
    delete updates.last_executed_at;
    
    // Add updated timestamp
    updates.updated_at = new Date().toISOString();
    
    // If workflow is being updated, validate it
    if (updates.workflow) {
      if (!updates.workflow.trigger || !updates.workflow.action) {
        return res.status(400).json({ error: 'Workflow must contain trigger and action' });
      }
      
      // Check if required services are connected
      if (updates.workflow.action.service) {
        const isConnected = await OAuthService.isServiceConnected(userId, updates.workflow.action.service);
        
        if (!isConnected) {
          return res.status(400).json({
            error: 'Required service not connected',
            service: updates.workflow.action.service,
            needsConnection: true
          });
        }
      }
    }
    
    // Update the automation
    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('id', automationId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ error: 'Failed to update automation', message: error.message });
  }
});

/**
 * @route DELETE /api/v1/automations/:id
 * @description Delete a configured automation
 * @access Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user.id;
    
    // Check if automation exists and belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('automations')
      .select('id')
      .eq('id', automationId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    
    // Delete the automation
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', automationId);
    
    if (error) {
      throw error;
    }
    
    res.json({ success: true, message: 'Automation deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ error: 'Failed to delete automation', message: error.message });
  }
});

/**
 * @route POST /api/v1/automations/:id/toggle
 * @description Toggle an automation's enabled status
 * @access Private
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user.id;
    const { enabled } = req.body;
    
    // Validate input
    if (enabled === undefined) {
      return res.status(400).json({ error: 'Enabled status is required' });
    }
    
    // Update the automation
    const { data, error } = await supabase
      .from('automations')
      .update({
        enabled: !!enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', automationId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error toggling automation:', error);
    res.status(500).json({ error: 'Failed to toggle automation', message: error.message });
  }
});

/**
 * @route POST /api/v1/automations/:id/execute
 * @description Manually execute a configured automation
 * @access Private
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user.id;
    const triggerData = req.body.triggerData || {};
    
    // Execute the automation
    const result = await AutomationExecutionService.executeConfiguredAutomation(
      automationId,
      triggerData,
      userId
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error executing automation:', error);
    res.status(500).json({ error: 'Failed to execute automation', message: error.message });
  }
});

/**
 * @route GET /api/v1/automations/:id/history
 * @description Get execution history for an automation
 * @access Private
 */
router.get('/:id/history', async (req, res) => {
  try {
    const automationId = req.params.id;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    // Check if automation exists and belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('automations')
      .select('id')
      .eq('id', automationId)
      .eq('user_id', userId)
      .single();
    
    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Automation not found' });
    }
    
    // Get execution history
    const history = await AutomationExecutionService.getExecutionHistory(userId, {
      automationId,
      limit
    });
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history', message: error.message });
  }
});

/**
 * @route GET /api/v1/automations/history
 * @description Get execution history for all automations
 * @access Private
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const { service, type, status } = req.query;
    
    // Get execution history
    const history = await AutomationExecutionService.getExecutionHistory(userId, {
      service,
      type,
      status,
      limit
    });
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history', message: error.message });
  }
});

/**
 * @route GET /api/v1/automations/templates
 * @description Get automation templates
 * @access Private
 */
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;
    
    // Build query
    let query = supabase
      .from('automations')
      .select('id, name, description, category, workflow, created_at, user_id')
      .eq('is_template', true);
    
    // Apply category filter if provided
    if (category) {
      query = query.eq('category', category);
    }
    
    // Get templates
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates', message: error.message });
  }
});

/**
 * @route POST /api/v1/automations/import/:templateId
 * @description Import an automation template
 * @access Private
 */
router.post('/import/:templateId', async (req, res) => {
  try {
    const templateId = req.params.templateId;
    const userId = req.user.id;
    const { name } = req.body;
    
    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', templateId)
      .eq('is_template', true)
      .single();
    
    if (templateError || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    // Create a new automation based on the template
    const { data, error } = await supabase
      .from('automations')
      .insert({
        id: uuidv4(),
        user_id: userId,
        name: name || `${template.name} (imported)`,
        description: template.description,
        category: template.category,
        workflow: template.workflow,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        enabled: true,
        execution_count: 0,
        is_template: false,
        imported_from: templateId
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Error importing template:', error);
    res.status(500).json({ error: 'Failed to import template', message: error.message });
  }
});

module.exports = router;
